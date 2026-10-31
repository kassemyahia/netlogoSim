import { assertEquals } from 'jsr:@std/assert@1';
import { memberSheetValues, projectSheetValues, teamMembersCell } from '../_shared/sheet-values.ts';

Deno.test('project mirror appends ordered team names without changing existing columns', () => {
  const members = [
    { id: 'b', project_id: 7, position: 2, name: 'الطالب الثاني', university_id: '22' },
    { id: 'a', project_id: 7, position: 1, name: 'الطالب الأول', university_id: '11' },
  ];
  const values = projectSheetValues({ id: 7, grade: 'السابع', subject: 'علوم', unit: 'وحدة', page: 3, idea_description: 'فكرة', team_label: 'فريق', created_at: 'c', updated_at: 'u', is_submitted: true }, { original_filename: 'x.html', size_bytes: 10, sha256: 'abc', version: 2 }, members);
  assertEquals(values.length, 15);
  assertEquals(values.slice(0, 14), [7, 'السابع', 'علوم', 'وحدة', '3', 'فكرة', 'فريق', 'c', 'u', 'true', 'x.html', '10', 'abc', '2']);
  assertEquals(values[14], 'الطالب الأول • الطالب الثاني');
});

Deno.test('sheet values neutralize formulas while preserving individual member rows', () => {
  const member = { id: 'a', project_id: 7, position: 1, name: '=IMPORTXML("x")', university_id: '+001' };
  assertEquals(teamMembersCell([member]), "'=IMPORTXML(\"x\")");
  assertEquals(memberSheetValues(member), ['a', 7, '1', "'=IMPORTXML(\"x\")", "'+001"]);
});

Deno.test('repeated synchronization produces identical project and member rows', () => {
  const project = { id: 7, grade: 'السابع', subject: 'علوم', unit: 'وحدة', page: 3, idea_description: 'فكرة', team_label: 'فريق', created_at: 'c', updated_at: 'u', is_submitted: false };
  const members = [{ id: 'a', project_id: 7, position: 1, name: 'طالب', university_id: '001' }];
  assertEquals(projectSheetValues(project, null, members), projectSheetValues(project, null, members));
  assertEquals(memberSheetValues(members[0]), memberSheetValues(members[0]));
});
