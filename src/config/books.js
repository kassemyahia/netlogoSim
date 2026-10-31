const BOOK_IDS = {
  '7-math': import.meta.env.VITE_BOOK_G7_MATH_ID,
  '7-science': import.meta.env.VITE_BOOK_G7_SCIENCE_ID,
  '7-physics': import.meta.env.VITE_BOOK_G7_PHYSICS_ID,
  // Keep the previous mathematics variables as an algebra fallback so an
  // existing deployment does not lose its configured book during the split.
  '8-algebra': import.meta.env.VITE_BOOK_G8_ALGEBRA_ID || import.meta.env.VITE_BOOK_G8_MATH_ID,
  '8-geometry': import.meta.env.VITE_BOOK_G8_GEOMETRY_ID,
  '8-science': import.meta.env.VITE_BOOK_G8_SCIENCE_ID,
  '8-physics': import.meta.env.VITE_BOOK_G8_PHYSICS_ID,
  '9-algebra': import.meta.env.VITE_BOOK_G9_ALGEBRA_ID || import.meta.env.VITE_BOOK_G9_MATH_ID,
  '9-geometry': import.meta.env.VITE_BOOK_G9_GEOMETRY_ID,
  '9-science': import.meta.env.VITE_BOOK_G9_SCIENCE_ID,
  '9-physics': import.meta.env.VITE_BOOK_G9_PHYSICS_ID,
};

export const GRADE_NAMES = {
  7: 'الصف السابع',
  8: 'الصف الثامن',
  9: 'الصف التاسع',
};

const DEFINITIONS = {
  7: [
    ['math', 'الرياضيات', 'كتاب الرياضيات'],
    ['science', 'العلوم', 'كتاب العلوم'],
    ['physics', 'الفيزياء والكيمياء', 'كتاب الفيزياء والكيمياء'],
  ],
  8: [
    ['algebra', 'الرياضيات', 'كتاب الجبر'],
    ['geometry', 'الرياضيات', 'كتاب الهندسة'],
    ['science', 'العلوم', 'كتاب العلوم'],
    ['physics', 'الفيزياء والكيمياء', 'كتاب الفيزياء والكيمياء'],
  ],
  9: [
    ['algebra', 'الرياضيات', 'كتاب الجبر'],
    ['geometry', 'الرياضيات', 'كتاب الهندسة'],
    ['science', 'العلوم', 'كتاب العلوم'],
    ['physics', 'الفيزياء والكيمياء', 'كتاب الفيزياء والكيمياء'],
  ],
};

function validDriveId(value) {
  const id = value?.trim();
  return id && /^[a-zA-Z0-9_-]{10,}$/.test(id) ? id : null;
}

export const BOOKS_BY_GRADE = Object.fromEntries(
  Object.entries(DEFINITIONS).map(([grade, books]) => [
    grade,
    books.map(([key, subject, title]) => {
      const fileId = validDriveId(BOOK_IDS[`${grade}-${key}`]);
      return {
        id: `g${grade}-${key}`,
        grade: GRADE_NAMES[grade],
        gradeSlug: grade,
        subject,
        title,
        fileId,
        viewUrl: fileId ? `https://drive.google.com/file/d/${fileId}/view` : null,
        openUrl: fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : null,
      };
    }),
  ]),
);

export const BOOKS = Object.values(BOOKS_BY_GRADE).flat();
