const fs = require('fs');
const p = 'igourmet-internal/src/pages/CombosTab.tsx';
let data = fs.readFileSync(p, 'utf8');

data = data.replace(
  `  const [description, setDescription] = useState(combo?.description ?? '')`,
  `  const [description, setDescription] = useState(combo?.description ?? '')
  const [imageUrl, setImageUrl] = useState(combo?.image_url ?? '')`
);

data = data.replace(
  `        description,`,
  `        description,
        image_url: imageUrl,`
);

data = data.replace(
  `        <Input label="Mô tả" value={description} onChange={(e) => setDescription(e.target.value)} />`,
  `        <Input label="Mô tả" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Input label="URL Ảnh" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />`
);

fs.writeFileSync(p, data);
console.log('patched CombosTab.tsx to include image_url');
