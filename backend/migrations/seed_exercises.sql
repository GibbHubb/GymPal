-- G13 — Seed 50 common exercises across the major muscle groups.
-- Idempotent via ON CONFLICT (name) DO NOTHING (`name` is unique per
-- the legacy createExercise duplicate-key check). Adds default rest
-- seconds tuned to compound-vs-isolation conventions.
--
-- Run AFTER add_exercise_library_fields.sql.

INSERT INTO exercises (name, muscle_group, difficulty, equipment, default_rest_seconds, is_global) VALUES
-- Chest
  ('Barbell Bench Press',         'Chest',     'Intermediate', 'barbell',   180, TRUE),
  ('Dumbbell Bench Press',        'Chest',     'Beginner',     'dumbbell',  150, TRUE),
  ('Incline Dumbbell Press',      'Chest',     'Intermediate', 'dumbbell',  150, TRUE),
  ('Push-Up',                     'Chest',     'Beginner',     'bodyweight', 60, TRUE),
  ('Cable Fly',                   'Chest',     'Intermediate', 'cable',      90, TRUE),
  ('Dip',                         'Chest',     'Intermediate', 'bodyweight',120, TRUE),
-- Back
  ('Deadlift',                    'Back',      'Advanced',     'barbell',   210, TRUE),
  ('Pull-Up',                     'Back',      'Intermediate', 'bodyweight',120, TRUE),
  ('Chin-Up',                     'Back',      'Intermediate', 'bodyweight',120, TRUE),
  ('Bent-Over Row',               'Back',      'Intermediate', 'barbell',   150, TRUE),
  ('Single-Arm Dumbbell Row',     'Back',      'Beginner',     'dumbbell',   90, TRUE),
  ('Lat Pulldown',                'Back',      'Beginner',     'cable',      90, TRUE),
  ('Cable Row',                   'Back',      'Beginner',     'cable',      90, TRUE),
  ('Face Pull',                   'Back',      'Beginner',     'cable',      60, TRUE),
-- Shoulders
  ('Overhead Press',              'Shoulders', 'Intermediate', 'barbell',   150, TRUE),
  ('Dumbbell Shoulder Press',     'Shoulders', 'Beginner',     'dumbbell',  120, TRUE),
  ('Lateral Raise',               'Shoulders', 'Beginner',     'dumbbell',   60, TRUE),
  ('Rear Delt Fly',               'Shoulders', 'Beginner',     'dumbbell',   60, TRUE),
  ('Arnold Press',                'Shoulders', 'Intermediate', 'dumbbell',  120, TRUE),
-- Arms
  ('Barbell Curl',                'Biceps',    'Beginner',     'barbell',    75, TRUE),
  ('Dumbbell Curl',               'Biceps',    'Beginner',     'dumbbell',   60, TRUE),
  ('Hammer Curl',                 'Biceps',    'Beginner',     'dumbbell',   60, TRUE),
  ('Preacher Curl',               'Biceps',    'Intermediate', 'barbell',    75, TRUE),
  ('Cable Curl',                  'Biceps',    'Beginner',     'cable',      60, TRUE),
  ('Tricep Pushdown',             'Triceps',   'Beginner',     'cable',      60, TRUE),
  ('Skullcrusher',                'Triceps',   'Intermediate', 'barbell',    90, TRUE),
  ('Overhead Tricep Extension',   'Triceps',   'Beginner',     'dumbbell',   60, TRUE),
  ('Close-Grip Bench Press',      'Triceps',   'Intermediate', 'barbell',   120, TRUE),
-- Legs
  ('Back Squat',                  'Legs',      'Intermediate', 'barbell',   210, TRUE),
  ('Front Squat',                 'Legs',      'Advanced',     'barbell',   180, TRUE),
  ('Romanian Deadlift',           'Legs',      'Intermediate', 'barbell',   180, TRUE),
  ('Leg Press',                   'Legs',      'Beginner',     'machine',   120, TRUE),
  ('Walking Lunge',               'Legs',      'Beginner',     'dumbbell',   90, TRUE),
  ('Bulgarian Split Squat',       'Legs',      'Intermediate', 'dumbbell',   90, TRUE),
  ('Leg Extension',               'Legs',      'Beginner',     'machine',    60, TRUE),
  ('Leg Curl',                    'Legs',      'Beginner',     'machine',    60, TRUE),
  ('Calf Raise',                  'Legs',      'Beginner',     'bodyweight', 45, TRUE),
  ('Hip Thrust',                  'Legs',      'Intermediate', 'barbell',   150, TRUE),
-- Core
  ('Plank',                       'Core',      'Beginner',     'bodyweight', 45, TRUE),
  ('Hanging Leg Raise',           'Core',      'Intermediate', 'bodyweight', 60, TRUE),
  ('Cable Crunch',                'Core',      'Beginner',     'cable',      45, TRUE),
  ('Russian Twist',               'Core',      'Beginner',     'bodyweight', 30, TRUE),
  ('Ab Wheel Rollout',            'Core',      'Intermediate', 'wheel',      60, TRUE),
  ('Pallof Press',                'Core',      'Beginner',     'cable',      45, TRUE),
-- Conditioning / full body
  ('Burpee',                      'Full Body', 'Beginner',     'bodyweight', 30, TRUE),
  ('Kettlebell Swing',            'Full Body', 'Intermediate', 'kettlebell', 60, TRUE),
  ('Clean and Press',             'Full Body', 'Advanced',     'barbell',   180, TRUE),
  ('Power Clean',                 'Full Body', 'Advanced',     'barbell',   210, TRUE),
  ('Farmer''s Walk',              'Full Body', 'Beginner',     'dumbbell',  120, TRUE),
  ('Box Jump',                    'Legs',      'Intermediate', 'box',        60, TRUE),
  ('Jump Rope',                   'Conditioning','Beginner',   'rope',       30, TRUE)
ON CONFLICT (name) DO NOTHING;
