const DEFAULT_BOOK_IDS = {
  '7-math': '1TAMZczR3MQYnKXRN5cAxFpfi1qlpGfP8',
  '7-science': '1pZAlXRuSXYP5a9ukg9Y99Gt0oNGq2INo',
  '7-physics': '1HeGkMPVNL0UhMwzmlKHiM8Rz0AkPfEQs',
  '8-algebra': '1HvYdBDsqy7qzfZzoDJjUu3ysDGCCJiXd',
  '8-geometry': '1XMQsJV0oe_765LszEDPP7692RSG01qjI',
  '8-science': '1CQsZjQ9Tv0QA2jygGrU8ponGq0eXxfXe',
  '8-physics': '1-cPZPgkz5PBFPqEDO6oFxcdddSxCNRRK',
  '9-algebra': '1KRGYcg-gA3Tvv_5Ug-xTSRTLlEzsBY4e',
  '9-geometry': '14SFfvd1PUR6c7zpwsldlO-Xh9G60ZHBL',
  '9-science': '1RSzOQgbEM6iXCMC_SK14vRjpv-dPxi0f',
  '9-physics': '1UX7525aeZ9CLHWizJgo-EthA5noCm54-',
};

const BOOK_IDS = {
  '7-math': import.meta.env.VITE_BOOK_G7_MATH_ID || DEFAULT_BOOK_IDS['7-math'],
  '7-science': import.meta.env.VITE_BOOK_G7_SCIENCE_ID || DEFAULT_BOOK_IDS['7-science'],
  '7-physics': import.meta.env.VITE_BOOK_G7_PHYSICS_ID || DEFAULT_BOOK_IDS['7-physics'],
  // Keep the previous mathematics variables as an algebra fallback so an
  // existing deployment does not lose its configured book during the split.
  '8-algebra': import.meta.env.VITE_BOOK_G8_ALGEBRA_ID || import.meta.env.VITE_BOOK_G8_MATH_ID || DEFAULT_BOOK_IDS['8-algebra'],
  '8-geometry': import.meta.env.VITE_BOOK_G8_GEOMETRY_ID || DEFAULT_BOOK_IDS['8-geometry'],
  '8-science': import.meta.env.VITE_BOOK_G8_SCIENCE_ID || DEFAULT_BOOK_IDS['8-science'],
  '8-physics': import.meta.env.VITE_BOOK_G8_PHYSICS_ID || DEFAULT_BOOK_IDS['8-physics'],
  '9-algebra': import.meta.env.VITE_BOOK_G9_ALGEBRA_ID || import.meta.env.VITE_BOOK_G9_MATH_ID || DEFAULT_BOOK_IDS['9-algebra'],
  '9-geometry': import.meta.env.VITE_BOOK_G9_GEOMETRY_ID || DEFAULT_BOOK_IDS['9-geometry'],
  '9-science': import.meta.env.VITE_BOOK_G9_SCIENCE_ID || DEFAULT_BOOK_IDS['9-science'],
  '9-physics': import.meta.env.VITE_BOOK_G9_PHYSICS_ID || DEFAULT_BOOK_IDS['9-physics'],
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
