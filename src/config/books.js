const BOOK_IDS = {
  '7-math': import.meta.env.VITE_BOOK_G7_MATH_ID,
  '7-science': import.meta.env.VITE_BOOK_G7_SCIENCE_ID,
  '7-physics': import.meta.env.VITE_BOOK_G7_PHYSICS_ID,
  '8-math': import.meta.env.VITE_BOOK_G8_MATH_ID,
  '8-science': import.meta.env.VITE_BOOK_G8_SCIENCE_ID,
  '8-physics': import.meta.env.VITE_BOOK_G8_PHYSICS_ID,
  '9-math': import.meta.env.VITE_BOOK_G9_MATH_ID,
  '9-science': import.meta.env.VITE_BOOK_G9_SCIENCE_ID,
  '9-physics': import.meta.env.VITE_BOOK_G9_PHYSICS_ID,
};

const SUBJECTS = [
  ['math', 'الرياضيات'],
  ['science', 'العلوم'],
  ['physics', 'الفيزياء والكيمياء'],
];
const GRADE_NAMES = { 7: 'الصف السابع', 8: 'الصف الثامن', 9: 'الصف التاسع' };

function validDriveId(value) {
  const id = value?.trim();
  return id && /^[a-zA-Z0-9_-]{10,}$/.test(id) ? id : null;
}

export const BOOKS = [7, 8, 9].flatMap((grade) =>
  SUBJECTS.map(([key, subject]) => {
    const fileId = validDriveId(BOOK_IDS[`${grade}-${key}`]);
    return {
      id: `g${grade}-${key}`,
      grade: GRADE_NAMES[grade],
      gradeSlug: String(grade),
      subject,
      fileId,
      viewUrl: fileId ? `https://drive.google.com/file/d/${fileId}/view` : null,
      openUrl: fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : null,
    };
  }),
);
