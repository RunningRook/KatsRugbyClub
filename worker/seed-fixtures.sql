-- 2026/27 Kats RFC season fixtures (BC Rugby Division 2)
-- Source: club-provided fixture list (BC Rugby's site isn't reachable from the
-- build environment that generated this). Kickoff is the club's typical 12:45
-- for every game; away venues are best-effort search terms (the opponent's
-- club name), not confirmed street addresses — double check via the Rugby
-- Canada app closer to each date, especially the two Bruins fixtures where no
-- venue is set at all.
--
-- Apply with: wrangler d1 execute kats-checkin --remote --file=./seed-fixtures.sql
-- Safe to re-run: INSERT OR REPLACE means editing a date/opponent above and
-- re-running just updates that row instead of duplicating it.

INSERT OR REPLACE INTO games (id, opponent, date, time, location, notes, created_at) VALUES ('2026-09-12-bruins-home', 'Bruins', '2026-09-12', '12:45', 'Balaclava Park, Vancouver, BC', '', '2026-09-06T21:45:53.375390Z');
INSERT OR REPLACE INTO games (id, opponent, date, time, location, notes, created_at) VALUES ('2026-09-26-chilliwack-home', 'Chilliwack', '2026-09-26', '12:45', 'Balaclava Park, Vancouver, BC', '', '2026-09-06T21:45:53.375390Z');
INSERT OR REPLACE INTO games (id, opponent, date, time, location, notes, created_at) VALUES ('2026-10-03-surrey-home', 'Surrey', '2026-10-03', '12:45', 'Balaclava Park, Vancouver, BC', '', '2026-09-06T21:45:53.375390Z');
INSERT OR REPLACE INTO games (id, opponent, date, time, location, notes, created_at) VALUES ('2026-10-17-sfu-away', 'SFU', '2026-10-17', '12:45', 'Simon Fraser Rugby', 'Away fixture — confirm final kickoff time/venue via the Rugby Canada app closer to the date.', '2026-09-06T21:45:53.375390Z');
INSERT OR REPLACE INTO games (id, opponent, date, time, location, notes, created_at) VALUES ('2026-10-24-lions-home', 'Lions', '2026-10-24', '12:45', 'Balaclava Park, Vancouver, BC', '', '2026-09-06T21:45:53.375390Z');
INSERT OR REPLACE INTO games (id, opponent, date, time, location, notes, created_at) VALUES ('2026-10-31-kamloops-away', 'Kamloops', '2026-10-31', '12:45', 'Kamloops RFC', 'Away fixture — confirm final kickoff time/venue via the Rugby Canada app closer to the date.', '2026-09-06T21:45:53.375390Z');
INSERT OR REPLACE INTO games (id, opponent, date, time, location, notes, created_at) VALUES ('2026-11-07-bruins-away', 'Bruins', '2026-11-07', '12:45', '', 'Away fixture — confirm final kickoff time/venue via the Rugby Canada app closer to the date.', '2026-09-06T21:45:53.375390Z');
INSERT OR REPLACE INTO games (id, opponent, date, time, location, notes, created_at) VALUES ('2026-11-14-kamloops-home', 'Kamloops', '2026-11-14', '12:45', 'Balaclava Park, Vancouver, BC', '', '2026-09-06T21:45:53.375390Z');
INSERT OR REPLACE INTO games (id, opponent, date, time, location, notes, created_at) VALUES ('2026-11-21-united-away', 'United', '2026-11-21', '12:45', 'United RC', 'Away fixture — confirm final kickoff time/venue via the Rugby Canada app closer to the date.', '2026-09-06T21:45:53.375390Z');
INSERT OR REPLACE INTO games (id, opponent, date, time, location, notes, created_at) VALUES ('2027-01-23-richmond-home', 'Richmond', '2027-01-23', '12:45', 'Balaclava Park, Vancouver, BC', '', '2026-09-06T21:45:53.375390Z');
INSERT OR REPLACE INTO games (id, opponent, date, time, location, notes, created_at) VALUES ('2027-01-30-chilliwack-away', 'Chilliwack', '2027-01-30', '12:45', 'Chilliwack RFC', 'Away fixture — confirm final kickoff time/venue via the Rugby Canada app closer to the date.', '2026-09-06T21:45:53.375390Z');
INSERT OR REPLACE INTO games (id, opponent, date, time, location, notes, created_at) VALUES ('2027-02-06-lions-away', 'Lions', '2027-02-06', '12:45', 'Brit Lions RFC', 'Away fixture — confirm final kickoff time/venue via the Rugby Canada app closer to the date.', '2026-09-06T21:45:53.375390Z');
INSERT OR REPLACE INTO games (id, opponent, date, time, location, notes, created_at) VALUES ('2027-02-20-united-home', 'United', '2027-02-20', '12:45', 'Balaclava Park, Vancouver, BC', '', '2026-09-06T21:45:53.375390Z');
INSERT OR REPLACE INTO games (id, opponent, date, time, location, notes, created_at) VALUES ('2027-02-27-sfu-home', 'SFU', '2027-02-27', '12:45', 'Balaclava Park, Vancouver, BC', '', '2026-09-06T21:45:53.375390Z');
INSERT OR REPLACE INTO games (id, opponent, date, time, location, notes, created_at) VALUES ('2027-03-13-scribes-away', 'Scribes', '2027-03-13', '12:45', 'Scribes RFC', 'Away fixture — confirm final kickoff time/venue via the Rugby Canada app closer to the date.', '2026-09-06T21:45:53.375390Z');
INSERT OR REPLACE INTO games (id, opponent, date, time, location, notes, created_at) VALUES ('2027-03-20-richmond-away', 'Richmond', '2027-03-20', '12:45', 'Richmond Rugby', 'Away fixture — confirm final kickoff time/venue via the Rugby Canada app closer to the date.', '2026-09-06T21:45:53.375390Z');
INSERT OR REPLACE INTO games (id, opponent, date, time, location, notes, created_at) VALUES ('2027-04-03-scribes-home', 'Scribes', '2027-04-03', '12:45', 'Balaclava Park, Vancouver, BC', '', '2026-09-06T21:45:53.375390Z');
INSERT OR REPLACE INTO games (id, opponent, date, time, location, notes, created_at) VALUES ('2027-04-10-surrey-away', 'Surrey', '2027-04-10', '12:45', 'Surrey Beavers RFC', 'Away fixture — confirm final kickoff time/venue via the Rugby Canada app closer to the date.', '2026-09-06T21:45:53.375390Z');
