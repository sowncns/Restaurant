const fs = require('fs');
let p = 'igourmet-internal/src/pages/KitchenPage.tsx';
let d = fs.readFileSync(p, 'utf8');

const historyTableOld = `<td className="py-2 px-3 font-medium">
                        {it.quantity}x {it.item_name}
                      </td>`;
const historyTableNew = `<td className="py-2 px-3 font-medium">
                        {it.quantity}x {it.item_name}
                        {it.is_mistake && <Badge className="ml-2 bg-red-100 text-red-700">NHẦM LẪN</Badge>}
                      </td>`;

const cardOld = `<div className="mt-1 text-sm font-medium text-slate-700">
            {it.item_name} <span className="text-slate-500">× {it.quantity}</span>
          </div>`;
const cardNew = `<div className="mt-1 text-sm font-medium text-slate-700 flex items-center gap-2">
            {it.item_name} <span className="text-slate-500">× {it.quantity}</span>
            {it.is_mistake && <Badge className="bg-red-500 text-white animate-pulse">ĐÃ BÁO NHẦM</Badge>}
          </div>`;

d = d.replace(historyTableOld, historyTableNew);
d = d.replace(cardOld, cardNew);

// Add toast logic for new mistakes in load()
const loadOld = `      setErr('')
    } catch (e) {
      setErr(errMsg(e))
    }
    // Dem yeu cau huy dang cho`;
const loadNew = `      setErr('')
      
      // Check for mistakes
      const hasMistakes = [...q, ...h].some(it => it.is_mistake);
      if (hasMistakes && !window.__mistakeAlerted) {
        window.__mistakeAlerted = true;
        // Just play a beep sound
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(() => {});
      }
    } catch (e) {
      setErr(errMsg(e))
    }
    // Dem yeu cau huy dang cho`;

d = d.replace(loadOld, loadNew);

fs.writeFileSync(p, d);
console.log('patched KitchenPage mistake notifications');
