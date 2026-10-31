export type SheetMember = {
  id: string;
  project_id: string | number;
  position: number;
  name: string;
  university_id: string;
};

export const sheetLiteral = (value: unknown) => {
  const text = value == null ? '' : String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
};

export function teamMembersCell(members: Pick<SheetMember, 'position' | 'name'>[]) {
  return [...members]
    .sort((first, second) => Number(first.position) - Number(second.position))
    .map((member) => sheetLiteral(member.name.trim()))
    .filter(Boolean)
    .join(' • ');
}

export function projectSheetValues(
  project: Record<string, unknown>,
  submission: Record<string, unknown> | null,
  members: SheetMember[],
) {
  return [
    project.id,
    project.grade,
    project.subject,
    sheetLiteral(project.unit),
    String(project.page),
    sheetLiteral(project.idea_description),
    sheetLiteral(project.team_label),
    project.created_at,
    project.updated_at,
    String(project.is_submitted),
    sheetLiteral(submission?.original_filename),
    submission?.size_bytes ? String(submission.size_bytes) : '',
    submission?.sha256 || '',
    submission?.version ? String(submission.version) : '',
    teamMembersCell(members),
  ];
}

export function memberSheetValues(member: SheetMember) {
  return [member.id, member.project_id, String(member.position), sheetLiteral(member.name), sheetLiteral(member.university_id)];
}
