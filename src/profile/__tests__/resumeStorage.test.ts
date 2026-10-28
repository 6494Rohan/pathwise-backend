import { countPdfPages, isOwnResumeKey } from '../resumeStorage';

describe('isOwnResumeKey', () => {
  const key = 'resumes/user-1/0b7f6c1e-2d3a-4f5b-8c9d-0e1f2a3b4c5d.pdf';

  it('accepts keys the upload URL generates for this user', () => {
    expect(isOwnResumeKey('user-1', key)).toBe(true);
  });

  it.each([
    ['another user', 'user-2', key],
    ['a path escape', 'user-1', 'resumes/user-1/../user-2/0b7f6c1e-2d3a-4f5b-8c9d-0e1f2a3b4c5d.pdf'],
    ['a made-up name', 'user-1', 'resumes/user-1/cv.pdf'],
  ])('rejects %s', (_case, userId, candidate) => {
    expect(isOwnResumeKey(userId, candidate)).toBe(false);
  });
});

describe('countPdfPages', () => {
  it('counts page objects but not the page tree', () => {
    const pdf = Buffer.from('%PDF-1.7 << /Type /Pages /Count 2 >> << /Type /Page >> << /Type/Page /Parent 1 0 R >>');

    expect(countPdfPages(pdf)).toBe(2);
  });
});
