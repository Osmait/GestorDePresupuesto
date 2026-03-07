UPDATE categorys
SET icon = 'hand-coins'
WHERE LOWER(TRIM(name)) = 'prestamos otorgados'
  AND icon = '💸';

UPDATE categorys
SET icon = 'landmark'
WHERE LOWER(TRIM(name)) = 'cobro de prestamos'
  AND icon = '💰';
