import type { Knex } from 'knex';
import type { EducationDto, ExperienceDto, ProfileDto, ResumeFile } from './profile.types';
import type { ResumeDetails } from './resumeSchema';

interface ProfileRow {
  user_id: string;
  profile_code: string;
  plan: ProfileDto['plan'];
  full_name: string | null;
  email: string | null;
  phone: string | null;
  current_designation: string | null;
  current_location: string | null;
  preferred_locations: string[];
  skills: string[];
  resume_key: string | null;
  resume_file_name: string | null;
  resume_size_bytes: number | null;
  resume_uploaded_at: Date | null;
}

type Db = Knex | Knex.Transaction;

export const toProfileDto = (row: ProfileRow, experiences: ExperienceDto[], educations: EducationDto[]): ProfileDto => ({
  profile_code: row.profile_code,
  plan: row.plan,
  full_name: row.full_name,
  email: row.email,
  phone: row.phone,
  current_designation: row.current_designation,
  current_location: row.current_location,
  preferred_locations: row.preferred_locations,
  skills: row.skills,
  resume:
    row.resume_key && row.resume_file_name && row.resume_size_bytes !== null && row.resume_uploaded_at
      ? {
          file_name: row.resume_file_name,
          file_type: 'pdf',
          size_bytes: row.resume_size_bytes,
          uploaded_at: row.resume_uploaded_at.toISOString(),
        }
      : null,
  experiences,
  educations,
});

const ensureProfile = (db: Db, userId: string) => db('profiles').insert({ user_id: userId }).onConflict('user_id').ignore();

const loadProfile = async (db: Db, userId: string): Promise<ProfileDto> => {
  const row: ProfileRow = await db('profiles').where({ user_id: userId }).first();
  const experiences: ExperienceDto[] = await db('profile_experiences')
    .where({ user_id: userId })
    .orderBy('position')
    .select('id', 'designation', 'company_name', 'start_month', 'end_month', 'description');
  const educations: EducationDto[] = await db('profile_educations')
    .where({ user_id: userId })
    .orderBy('position')
    .select('id', 'institution', 'degree', 'start_month', 'end_month');
  return toProfileDto(row, experiences, educations);
};

// A signed-in user always has a profile: the first read creates an empty one.
export const getOrCreateProfile = async (db: Knex, userId: string): Promise<ProfileDto> => {
  await ensureProfile(db, userId);
  return loadProfile(db, userId);
};

export const getResumeFile = async (db: Knex, userId: string): Promise<Pick<ResumeFile, 'key' | 'fileName'> | null> => {
  const row = await db('profiles').where({ user_id: userId }).first('resume_key', 'resume_file_name');
  return row?.resume_key && row.resume_file_name ? { key: row.resume_key, fileName: row.resume_file_name } : null;
};

// Counts the attempt before the AI call, so failed parses count too. Returns false once the user's or the app's
// limit for today (UTC) is used up.
export const reserveResumeParse = async (
  db: Knex,
  userId: string,
  limits: { perUser: number; total: number }
): Promise<boolean> => {
  await ensureProfile(db, userId);
  const result = await db.raw(
    `INSERT INTO resume_parse_usage (user_id, day, count)
     SELECT ?, (now() AT TIME ZONE 'utc')::date, 1
     WHERE (SELECT coalesce(sum(count), 0) FROM resume_parse_usage WHERE day = (now() AT TIME ZONE 'utc')::date) < ?
     ON CONFLICT (user_id, day) DO UPDATE SET count = resume_parse_usage.count + 1
     WHERE resume_parse_usage.count < ?
     RETURNING count`,
    [userId, limits.total, limits.perUser]
  );
  return result.rows.length > 0;
};

// Replaces experience, education and skills with the resume's; a detail the resume doesn't state keeps its old value.
export const saveParsedResume = (db: Knex, userId: string, resume: ResumeDetails, file: ResumeFile) =>
  db.transaction(async (trx) => {
    await ensureProfile(trx, userId);
    const previous: ProfileRow = await trx('profiles').where({ user_id: userId }).forUpdate().first();

    await trx('profiles')
      .where({ user_id: userId })
      .update({
        full_name: resume.full_name ?? previous.full_name,
        email: resume.email ?? previous.email,
        phone: resume.phone ?? previous.phone,
        current_designation: resume.current_designation ?? previous.current_designation,
        current_location: resume.current_location ?? previous.current_location,
        skills: resume.skills.length > 0 ? resume.skills : previous.skills,
        resume_key: file.key,
        resume_file_name: file.fileName,
        resume_size_bytes: file.sizeBytes,
        resume_uploaded_at: trx.fn.now(),
        updated_at: trx.fn.now(),
      });

    await trx('profile_experiences').where({ user_id: userId }).delete();
    if (resume.experiences.length > 0) {
      await trx('profile_experiences').insert(resume.experiences.map((job, position) => ({ ...job, user_id: userId, position })));
    }
    await trx('profile_educations').where({ user_id: userId }).delete();
    if (resume.educations.length > 0) {
      await trx('profile_educations').insert(resume.educations.map((school, position) => ({ ...school, user_id: userId, position })));
    }

    return { profile: await loadProfile(trx, userId), previousResumeKey: previous.resume_key };
  });
