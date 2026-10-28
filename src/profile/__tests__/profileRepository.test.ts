import { toProfileDto } from '../profileRepository';

const row = {
  user_id: 'user-1',
  profile_code: 'AB12CD34',
  plan: 'guest' as const,
  full_name: 'Aarav Menon',
  email: null,
  phone: null,
  current_designation: null,
  current_location: null,
  preferred_locations: [],
  skills: ['Python'],
  resume_key: null,
  resume_file_name: null,
  resume_size_bytes: null,
  resume_uploaded_at: null,
};

describe('toProfileDto', () => {
  it('has no resume until one is saved', () => {
    expect(toProfileDto(row, [], []).resume).toBeNull();
  });

  it('describes the saved resume without exposing its storage key', () => {
    const dto = toProfileDto(
      {
        ...row,
        resume_key: 'resumes/user-1/x.pdf',
        resume_file_name: 'Aarav.pdf',
        resume_size_bytes: 1200,
        resume_uploaded_at: new Date('2026-10-27T10:00:00Z'),
      },
      [],
      []
    );

    expect(dto.resume).toEqual({ file_name: 'Aarav.pdf', file_type: 'pdf', size_bytes: 1200, uploaded_at: '2026-10-27T10:00:00.000Z' });
    expect(JSON.stringify(dto)).not.toContain('resumes/user-1');
    expect(dto).not.toHaveProperty('user_id');
  });
});
