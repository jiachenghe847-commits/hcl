-- Fictional counsellors (from the original prototype). No real people. Slots are generated at runtime (src/catalog/slots.ts).
INSERT INTO counsellors (id, display_name, languages, focus_areas, modes, bio) VALUES
  ('c-tan', 'Dr. Tan Mei Ling', '["en","zh"]', '["anxiety","academic_stress","sleep"]', '["in_person","video"]',
   'Clinical counsellor who works mainly with students facing exam pressure and anxiety.'),
  ('c-hafiz', 'Encik Hafiz Rahman', '["en","ms"]', '["relationships","financial_stress","academic_stress"]', '["in_person","chat"]',
   'Registered counsellor with a practical, solution-focused approach.'),
  ('c-priya', 'Ms. Priya Nair', '["en"]', '["burnout","work_stress","low_mood"]', '["video","in_person"]',
   'Sees both students and academic staff. Staff sessions run in a separate room.'),
  ('c-zhou', 'Mr. Zhou Yang', '["zh","en"]', '["homesickness","loneliness","low_mood"]', '["video","chat"]',
   'Supports international students settling into campus life.');
