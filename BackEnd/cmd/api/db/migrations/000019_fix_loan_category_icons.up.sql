UPDATE categorys
SET icon = '💸'
WHERE LOWER(TRIM(name)) = 'prestamos otorgados'
  AND icon IN ('hand-coins', 'hand_coins', 'handcoins');

UPDATE categorys
SET icon = '💰'
WHERE LOWER(TRIM(name)) = 'cobro de prestamos'
  AND icon IN ('landmark', 'bank', 'coins');
