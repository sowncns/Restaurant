const fs = require('fs');
const p = 'igourmet-internal/src/components/CheckoutPanel.tsx';
let data = fs.readFileSync(p, 'utf8');

// Replace React.useMemo with useMemo
data = data.replace(/React\.useMemo/g, 'useMemo');

// Add useMemo to imports
if (!data.includes('useMemo')) {
  data = data.replace('import { useCallback, useEffect, useState } from \'react\'', 'import { useCallback, useEffect, useState, useMemo } from \'react\'');
}

fs.writeFileSync(p, data);
console.log('patched CheckoutPanel.tsx for useMemo');
