import { isOldHost, transferUrl, localRecordCount, NEW_HOME } from '../store/transfer';
import { useStore } from '../store/store';

/** Shown only on the old github.io address: points to the new home and carries this device's entries over. */
export default function Moved() {
  useStore();
  if (!isOldHost()) return null;
  const n = localRecordCount();
  return (
    <aside className="moved" role="status">
      <span><strong>DEVA has moved</strong> to kalladhanush.in/deva{n ? ` — ${n} saved entr${n > 1 ? 'ies' : 'y'} on this device` : ''}</span>
      <a className="btn primary" href={NEW_HOME} onClick={(e) => { e.preventDefault(); location.href = n ? transferUrl() : NEW_HOME; }}>{n ? 'Carry my data over →' : 'Open →'}</a>
    </aside>
  );
}
