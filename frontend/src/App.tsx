import { useState, useEffect, useRef } from 'react';

const API = '';

function App() {
  const WORD_DATA_BACKUP = [
    { word: 'mat', weight: 5 },
    { word: 'mjölk', weight: 4 },
    { word: 'bröd', weight: 4 },
    { word: 'ägg', weight: 4 },
    { word: 'kaffe', weight: 3 },
    { word: 'handla', weight: 3 },
    { word: 'middag', weight: 3 },
    { word: 'frukost', weight: 3 },
    { word: 'puss', weight: 5 },
    { word: 'kram!', weight: 5 },
    { word: 'gurka :-)', weight: 4 },
    { word: 'banan', weight: 3 },
    { word: 'apelsin', weight: 3 },
    { word: 'smör', weight: 2 },
    { word: 'ost', weight: 2 },
    { word: 'skinka', weight: 2 },
    { word: 'yoghurt', weight: 2 },
    { word: 'juice', weight: 2 },
    { word: 'pålägg', weight: 2 },
    { word: 'glömt', weight: 1 },
    { word: 'nödvändigt', weight: 1 },
    { word: 'älskar dig', weight: 1 },
    { word: 'du är bäst', weight: 1 },
  ];

  const fontSize = (w) => 12 + w * 9;
  const colors = ['#818cf8', '#c084fc', '#f472b6', '#fb923c', '#fbbf24', '#a78bfa', '#34d399'];

  const getPosition = (i: number) => ({
    left: ((i * 37) % 80) + 8,
    top: ((i * 53) % 70) + 12,
  });

  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [user, setUser] = useState(null);
  const [view, setView] = useState('landing');
  const [list, setList] = useState(null);
  const [lists, setLists] = useState([]);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [detailItem, setDetailItem] = useState(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [newListName, setNewListName] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteUsernameValid, setInviteUsernameValid] = useState(false);
  const [inviteUsernameChecking, setInviteUsernameChecking] = useState(false);
  const [inviteListId, setInviteListId] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [members, setMembers] = useState([]);
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [showRegPwd, setShowRegPwd] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [saving, setSaving] = useState(false);
  const [completedExpanded, setCompletedExpanded] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (token && !authChecked) {
      setAuthChecked(true);
      fetch(API + '/api/auth/me', { headers: { Authorization: 'Bearer ' + token } })
        .then((r) => r.json())
        .then((d) => {
          if (d.user) {
            setUser(d.user);
            setView('lists');
          } else {
            localStorage.removeItem('token');
            setToken(null);
            setView('landing');
          }
        })
        .catch(() => {
          localStorage.removeItem('token');
          setToken(null);
          setView('landing');
        });
    }
  }, [token, authChecked]);

  useEffect(() => {
    if (token && view === 'lists') {
      loadLists();
    }
  }, [token, view]);

  useEffect(() => {
    if (token && list) {
      loadItems(list.id);
    }
  }, [token, list]);

  useEffect(() => {
    if (showInvite) {
      setError('');
    }
  }, [showInvite]);

  async function auth(path, body) {
    if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      setError('Ange en giltig e-postadress');
      return null;
    }
    setSaving(true);
    try {
      const res = await fetch(API + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Misslyckades'); return null; }
      return data;
    } catch (e) {
      setError('Kunde inte nå servern. Är du på samma Wi-Fi?');
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function loadLists() {
    const res = await fetch(API + '/api/lists', { headers: { Authorization: 'Bearer ' + token } });
    const data = await res.json();
    if (res.ok) {
      setLists(data.lists || []);
      setError('');
    } else {
      setError(data.error || 'Misslyckades ladda listor');
    }
  }

  async function createList() {
    if (!newListName) return;
    const res = await fetch(API + '/api/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ name: newListName }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Misslyckades skapa lista'); return; }
    setError('');
    setNewListName('');
    await loadLists();
  }

  async function deleteList(id) {
    if (!confirm('Ta bort listan och alla uppgifter?')) return;
    const res = await fetch(API + '/api/lists/' + id, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token },
    });
    if (res.ok) {
      await loadLists();
      if (list && list.id === id) {
        setList(null);
        setView('lists');
      }
    }
  }

  async function inviteToList(listId, username) {
    if (!inviteUsernameValid) {
      setError('Användaren finns inte');
      return false;
    }
    const res = await fetch(API + '/api/lists/' + listId + '/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ username }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.error && data.error.includes('User already has access')) {
        setError('Användaren är redan medlem i listan');
      } else {
        setError(data.error || 'Misslyckades bjuda in');
      }
      return false;
    }
    setError('');
    setInviteUsername('');
    setInviteUsernameValid(false);
    setInviteListId(null);
    setShowInvite(false);
    return true;
  }

  const checkUsernameTimer = useRef<NodeJS.Timeout | null>(null);

  async function checkUsername(username: string) {
    if (checkUsernameTimer.current) {
      clearTimeout(checkUsernameTimer.current);
      checkUsernameTimer.current = null;
    }
    if (!username || username.length < 3) {
      setInviteUsernameValid(false);
      setInviteUsernameChecking(false);
      return;
    }
    setInviteUsernameChecking(true);
    checkUsernameTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(API + '/api/auth/check-username?username=' + encodeURIComponent(username));
        const data = await res.json();
        setInviteUsernameValid(data.exists === true);
      } catch {
        setInviteUsernameValid(false);
      } finally {
        setInviteUsernameChecking(false);
        checkUsernameTimer.current = null;
      }
    }, 400);
  }

  async function loadItems(listId) {
    const res = await fetch(API + '/api/lists/' + listId + '/items', {
      headers: { Authorization: 'Bearer ' + token },
    });
    const data = await res.json();
    if (res.ok) { setItems(data.items || []); setError(''); } else setError(data.error || 'Misslyckades ladda uppgifter');
    await loadMembers(listId);
  }

  async function loadMembers(listId) {
    const res = await fetch(API + '/api/lists/' + listId + '/members', {
      headers: { Authorization: 'Bearer ' + token },
    });
    const data = await res.json();
    if (res.ok) { setMembers(data.members || []); } // +1 for the owner
  }

  async function addItem() {
    if (!newItemName || !list) return;
    const res = await fetch(API + '/api/lists/' + list.id + '/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ name: newItemName, created_by: navigator.userAgent }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Misslyckades lägga till'); return; }
    setError('');
    setNewItemName('');
    await loadItems(list.id);
  }

  async function toggleItem(itemId, completed) {
    if (!list) return;
    await fetch(API + '/api/lists/' + list.id + '/items/' + itemId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ completed }),
    });
    await loadItems(list.id);
  }

  async function toggleStarred(itemId, starred) {
    if (!list) return;
    await fetch(API + '/api/lists/' + list.id + '/items/' + itemId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ starred }),
    });
    await loadItems(list.id);
  }

  async function deleteItem(itemId) {
    if (!list) return;
    if (!confirm('Ta bort varan?')) return;
    await fetch(API + '/api/lists/' + list.id + '/items/' + itemId, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token },
    });
    await loadItems(list.id);
  }

  async function handleLogout(e: any) {
    if (e) e.stopPropagation();
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setView('landing');
    setShowUserMenu(false);
  }

  const page = 'bg-[#0a0a0a] min-h-[100dvh] w-full flex flex-col items-center pt-0 pb-[calc(20px+env(safe-area-inset-bottom))] px-4 text-white font-sans antialiased';
  const card = 'bg-[#17171e] border border-[#2a2a2e] rounded-xl shadow-lg';
  const inputBase = 'p-3 px-4 text-sm border border-[#3a3a3e] rounded-xl outline-none bg-[#17171e] text-white w-full min-h-[44px] box-border focus:border-indigo-500 transition-colors duration-150';
  const btnPrimary = 'bg-indigo-600 text-white font-semibold border-none rounded-xl cursor-pointer min-h-[44px] px-4 text-sm hover:bg-indigo-700 transition-all duration-150 shadow-md shadow-indigo-500/20';
  const btnDanger = 'bg-red-600 text-white font-semibold border-none rounded-xl cursor-pointer min-h-[36px] min-w-[36px] p-2 flex items-center justify-center hover:bg-red-700 transition-colors duration-150';
  const btnOutline = 'bg-transparent text-indigo-600 border border-indigo-600 font-semibold rounded-xl cursor-pointer min-h-[44px] px-4 text-sm hover:bg-indigo-600/10 transition-all duration-150';

  if (view === 'landing') {
    return (
      <div className={page}>
        <div className="max-w-[520px] w-full text-center py-20 px-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white block mx-auto mb-6"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          <h1 className="mb-2 mt-0 text-3xl font-extrabold text-white tracking-tight">The List</h1>
          <p className="mt-0 text-sm text-slate-400">Den enkla listan för dig och din familj</p>
          <div className="relative w-full h-[280px] mt-12 mb-12 rounded-2xl bg-[#17171e] border border-[#2a2a2e] p-2 overflow-hidden">
            {WORD_DATA_BACKUP.map((d, i) => {
              const pos = getPosition(i);
              const delay = i * 0.1;
              return (
                <span
                  key={i}
                  className="absolute text-white font-bold select-none animate-pulse"
                  style={{
                    left: `${pos.left}%`,
                    top: `${pos.top}%`,
                    fontSize: `${fontSize(d.weight)}px`,
                    color: colors[i % colors.length],
                    transform: i % 3 === 0 ? 'rotate(0deg)' : i % 3 === 1 ? 'rotate(90deg)' : 'rotate(-90deg)',
                    transformOrigin: 'center',
                    whiteSpace: 'nowrap',
                    animationDelay: `${delay}s`,
                    animationDuration: `${2.5 + d.weight * 0.4}s`,
                  }}
                >
                  {d.word}
                </span>
              );
            })}
          </div>
          <div className="flex flex-col gap-3 mt-12">
            <button className={btnPrimary} onClick={() => setView('register')}>Skapa konto</button>
            <button className={btnOutline} onClick={() => setView('login')}>Jag har redan ett konto</button>
          </div>
          <div className={`${card} mt-8 p-5 w-full`}>
            <div className="text-indigo-500 text-xl mb-2">★★★★★</div>
            <p className="text-sm text-white mb-1">"Vår familj sparar så mycket tid varje vecka."</p>
            <p className="text-xs text-slate-400 font-medium">— Tony</p>
          </div>
          <div className={`${card} mt-4 p-5 w-full`}>
            <div className="text-indigo-500 text-xl mb-2">★★★★☆</div>
            <p className="text-sm text-white mb-1">"Enkelt att dela listor med hela hushållet."</p>
            <p className="text-xs text-slate-400 font-medium">— Maria</p>
          </div>
          <div className={`${card} mt-4 p-5 w-full`}>
            <div className="text-indigo-500 text-xl mb-2">★★★★★</div>
            <p className="text-sm text-white mb-1">"Älskar att kunna kryssa av saker tillsammans."</p>
            <p className="text-xs text-slate-400 font-medium">— Amir</p>
          </div>
          <button className="text-indigo-500 text-sm mt-6 hover:underline cursor-pointer">Visa fler recensioner →</button>
        </div>
      </div>
    );
  }

  if (view === 'login') {
    return (
      <div className={page}>
        <div className="max-w-[440px] w-full py-8 px-4">
          <div className="flex flex-col items-center justify-between gap-4 mb-8">
            <h1 className="mt-0 mb-0 text-xl font-extrabold text-white tracking-tight">The List</h1>
          </div>
          <form className="flex flex-col gap-3 mb-6" onSubmit={async (e) => {
            e.preventDefault();
            const data = await auth('/api/auth/login', { username: loginEmail, password: loginPassword });
            if (data) {
              setToken(data.token);
              setUser(data.user);
              localStorage.setItem('token', data.token);
              setView('lists');
            }
          }}>
            <input type="text" name="username" value={loginEmail} onChange={(e) => { setLoginEmail(e.target.value); setError(''); }} placeholder="Användarnamn" className={inputBase} required autoComplete="username" />
            <div className="relative w-full">
              <input name="password" type={showLoginPwd ? 'text' : 'password'} value={loginPassword} onChange={(e) => { setLoginPassword(e.target.value); setError(''); }} placeholder="Lösenord" className="pr-12 p-3 px-4 text-sm border border-[#3a3a3e] rounded-xl outline-none bg-[#17171e] text-white w-full min-h-[44px] box-shadow focus:border-indigo-500 transition-colors duration-150" autoComplete="current-password" />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer p-0 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white transition-colors" onClick={() => setShowLoginPwd(!showLoginPwd)}>{showLoginPwd ? '🔓' : '🔒'}</button>
            </div>
            <button type="submit" className={btnPrimary}>Logga in</button>
          </form>
          <p className="text-xs text-indigo-500 cursor-pointer text-left px-2 min-h-[40px] hover:bg-[#17171e] transition-colors">
            Har du inte ett konto?{' '}
            <button type="button" className="text-indigo-500 underline underline-offset-2" onClick={() => setView('register')}>Skapa konto</button>
          </p>
          {error && <div className="text-xs text-red-400 bg-red-900/20 border border-red-900/30 rounded-lg p-3 px-4 mb-4 flex items-center gap-2">⚠ {error}</div>}
        </div>
      </div>
    );
  }

  if (view === 'register') {
    return (
      <div className={page}>
        <div className="max-w-[440px] w-full py-8 px-4">
          <div className="flex flex-col items-center justify-between gap-4 mb-8">
            <h1 className="mt-0 mb-0 text-xl font-extrabold text-white tracking-tight">The List</h1>
          </div>
          <form className="flex flex-col gap-3 mb-6" onSubmit={async (e) => {
            e.preventDefault();
            const data = await auth('/api/auth/register', { username: regUsername, email: regEmail, password: regPassword, fullName: regFullName });
            if (data) {
              setToken(data.token);
              setUser(data.user);
              localStorage.setItem('token', data.token);
              setView('lists');
            }
          }}>
            <input type="text" name="username" value={regUsername} onChange={(e) => { setRegUsername(e.target.value); setError(''); }} placeholder="Användarnamn" className={inputBase} required autoComplete="username" />
            <input type="text" name="fullName" value={regFullName} onChange={(e) => { setRegFullName(e.target.value); setError(''); }} placeholder="För- och efternamn" className={inputBase} required autoComplete="name" />
            <input type="email" name="email" value={regEmail} onChange={(e) => { setRegEmail(e.target.value); setError(''); }} placeholder="E-post" className={inputBase} required autoComplete="email" />
            <div className="relative w-full">
              <input name="password" type={showRegPwd ? 'text' : 'password'} value={regPassword} onChange={(e) => { setRegPassword(e.target.value); setError(''); }} placeholder="Lösenord" className="pr-12 p-3 px-4 text-sm border border-[#3a3a3e] rounded-xl outline-none bg-[#17171e] text-white w-full min-h-[44px] box-shadow focus:border-indigo-500 transition-colors duration-150" autoComplete="new-password" />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer p-0 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white transition-colors" onClick={() => setShowRegPwd(!showRegPwd)}>{showRegPwd ? '🔓' : '🔒'}</button>
            </div>
            <button type="submit" className={btnPrimary}>Skapa konto</button>
          </form>
          <p className="text-xs text-indigo-500 cursor-pointer text-left px-2 min-h-[40px] hover:bg-[#17171e] transition-colors">
            Har du redan ett konto?{' '}
            <button type="button" className="text-indigo-500 underline underline-offset-2" onClick={() => setView('login')}>Logga in</button>
          </p>
          {error && <div className="text-xs text-red-400 bg-red-900/20 border border-red-900/30 rounded-lg p-3 px-4 mb-4 flex items-center gap-2">⚠ {error}</div>}
        </div>
      </div>
    );
  }

  if (view === 'lists') {
    return (
      <div className={page} onClick={() => setShowUserMenu(false)}>
        <header className="px-4 py-4 w-full self-stretch border-b border-[#2a2a2e]">
          <div className="flex items-center justify-between w-full self-stretch">
            <div className="flex items-center gap-2">
              <div className="border-2 border-indigo-600 text-white rounded-full flex items-center justify-center w-10 h-10 text-sm font-bold" onClick={(e) => { e.stopPropagation(); setShowUserMenu(true); }}>{user?.username.charAt(0).toUpperCase()}</div>
              <span className="text-sm font-medium text-white">{user?.full_name}</span>
            </div>
          </div>
          {showUserMenu && (
            <div className="fixed inset-0 flex items-start justify-center z-50 p-6 pt-[25%]">
              <div className="bg-[#17171e] border border-[#2a2a2e] rounded-2xl shadow-2xl w-[320px] p-5">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <div className="border-2 border-indigo-600 text-white rounded-full flex items-center justify-center w-10 h-10 text-sm font-bold">{user?.username.charAt(0).toUpperCase()}</div>
                    <div className="flex flex-col gap-0">
                      <div className="text-sm font-medium text-white">{user?.full_name}</div>
                      <div className="text-xs text-slate-400">@{user?.username}</div>
                    </div>
                  </div>
                  <div className="border-t border-[#2a2a2e] pt-3">
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-slate-400 w-[40px]">E-post</div>
                      <div className="text-xs text-white break-all">{user?.email}</div>
                    </div>
                  </div>
                  <button className="w-full p-2.5 text-red-400 font-medium text-sm hover:bg-[#2a2a2e] transition-colors rounded-lg border border-[#2a2a2e] hover:border-red-400 text-center" onClick={(e) => { e.stopPropagation(); handleLogout(e); }}>
                    Logga ut
                  </button>
                </div>
              </div>
            </div>
          )}
        </header>
        <div className="w-full">
          <ul className="list-none p-0 m-0">
            {lists.map((l) => (
              <li key={l.id} className="flex items-center justify-between p-4 px-5 border-b border-[#2a2a2e] text-sm min-h-[52px] hover:bg-[#17171e]/30 transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); setList(l); setView('items'); loadItems(l.id); }}>
                <div className="flex items-center gap-3">
                  <div className="bg-[#17171e] border border-[#3a3a3e] rounded-lg p-2 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                  </div>
                  <span className="text-sm font-medium text-white overflow-hidden truncate">{l.name}</span>
                  {l.is_owner === false && (
                                    <span className="text-slate-500 text-xs cursor-pointer">delad</span>
                                  )}
                </div>
                <span className="text-xs text-slate-500">{l.item_count || 0} {l.item_count === 1 ? 'uppgift' : 'uppgifter'}</span>
              </li>
            ))}
            {lists.length === 0 && <li className="p-4 px-5 text-center text-slate-400 text-sm">Inga listor än. Skapa din första lista ovan! 🛒</li>}
          </ul>
        </div>
        <div className="fixed inset-x-0 bottom-0 w-full border-t border-[#2a2a2e] bg-[#0a0a0a] pb-[calc(20px+env(safe-area-inset-bottom))] pt-4 px-4">
          <div className="flex items-center gap-3">
            <button className="text-slate-400 cursor-pointer p-2 rounded-full hover:bg-[#17171e] transition-colors" onClick={createList}><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
            <input value={newListName} onChange={(e) => setNewListName(e.target.value)} onKeyPress={(e) => { if (e.key === 'Enter') createList(); }} placeholder="Ny lista" className="flex-1 p-3 px-4 text-sm border border-[#3a3a3e] rounded-xl outline-none bg-[#17171e] text-white min-h-[44px] box-border focus:border-indigo-500 transition-colors duration-150" />
          </div>
        </div>
      </div>
    );
  }

  if (view === 'items') {
    return (
      <div className={page} onClick={() => setShowUserMenu(false)}>
        <header className="px-4 py-4 w-full self-stretch border-b border-[#2a2a2e]">
          <div className="flex items-center justify-between w-full self-stretch">
            <button className="bg-transparent border-none text-indigo-500 font-bold text-xl p-2 min-w-[44px] min-h-[44px] rounded-xl hover:bg-[#17171e] transition-colors flex items-center gap-2" onClick={() => setView('lists')}>{'<'} <span>Listor</span></button>
            <div className="flex items-center gap-0">
              <button className="bg-transparent border-none text-indigo-500 p-2 min-w-[44px] min-h-[44px] rounded-xl hover:bg-[#17171e] transition-colors" onClick={() => { if (list) { setInviteListId(list.id); setShowInvite(true); } }}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-4-4h3.5"/><circle cx="18" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg></button>
              <span className="text-indigo-500 font-bold text-sm -ml-2">{members.length + 1}</span>
            </div>
          </div>
        </header>
        <div className="px-4 mb-2 w-full">
          <h1 className="mb-0 mt-0 text-3xl font-bold text-indigo-400 tracking-tight leading-none text-left">{list?.name}</h1>
        </div>
        {showInvite && inviteListId && (
          <div className="fixed inset-0 bg-[#0a0a0a]/90 flex items-center justify-center z-50 p-4">
            <div className={`${card} p-6 px-5 w-[min(92vw,340px)] shadow-2xl m-0`}>
              <h3 className="mb-4 mt-0 text-lg font-bold text-white">Dela lista</h3>
              <div className="mb-4">
                <h4 className="mb-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Listmedlemmar</h4>
                <div className="space-y-2 p-3 bg-[#17171e] border border-[#2a2a2e] rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="border-2 border-indigo-600 text-white rounded-full flex items-center justify-center w-9 h-9 text-sm font-bold">{user?.username.charAt(0).toUpperCase()}</div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white">{user?.full_name || user?.username}</div>
                      <div className="text-[10px] text-slate-500">Ägare</div>
                    </div>
                  </div>
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 py-1">
                      <div className="border-2 border-indigo-600 text-white rounded-full flex items-center justify-center w-9 h-9 text-sm font-bold">{m.username.charAt(0).toUpperCase()}</div>
                      <div className="flex-1 text-sm font-medium text-white whitespace-nowrap truncate">{m.full_name || m.username}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mb-3">
                <div className="text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Bjud in</div>
                <div className="relative">
                  <input value={inviteUsername} onChange={(e) => { setInviteUsername(e.target.value); checkUsername(e.target.value); setError(''); }} placeholder="Användarnamn" className={`${inputBase} pr-10`} />
                  {inviteUsernameValid ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-500">✔</span> : inviteUsername && !inviteUsernameValid ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-red-500">✖</span> : ''}
                </div>
                {inviteUsernameChecking ? <span className="text-xs text-slate-400 mt-1">Söker...</span> : ''}
              </div>
              <div className="flex flex-col gap-2 mt-5">
                {error && <div className="text-xs text-red-400 bg-red-900/20 border border-red-900/30 rounded-lg p-2 px-3 flex items-center gap-1 w-full">⚠ {error}</div>}
                <button className="flex-1 px-4 py-2.5 text-sm font-bold bg-indigo-600 text-white border-none rounded-xl cursor-pointer min-h-[44px] hover:bg-indigo-700 transition-colors" onClick={() => { if (inviteUsername && inviteListId) inviteToList(inviteListId, inviteUsername); }} >Skicka</button>
                <button className="flex-1 px-4 py-2.5 text-sm font-bold bg-transparent text-slate-400 border border-[#3a3a3e] rounded-xl cursor-pointer min-h-[44px] hover:bg-[#17171e] transition-colors" onClick={() => setShowInvite(false)}>Avbryt</button>
              </div>
            </div>
          </div>
        )}
        {!showInvite && error && <div className="text-xs text-red-400 bg-red-900/20 border border-red-900/30 rounded-lg p-3 px-4 mb-4 flex items-center gap-2 mx-4">⚠ {error}</div>}
        <div className="flex-1 overflow-y-auto overflow-touch w-full px-4 pb-20">
          <div className="space-y-2">
            {items.filter((i) => i.completed !== 1).sort((a, b) => (b.starred || 0) - (a.starred || 0)).map((item) => (
              <div key={item.id} className={`${card} p-4 flex items-center justify-between gap-3`}>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={item.completed === 1}
                    onChange={() => toggleItem(item.id, !item.completed)}
                    className="w-6 h-6 cursor-pointer shrink-0 rounded-full appearance-none border-2 border-[#5a5a5e] bg-[#17171e] focus:border-indigo-500 transition-all duration-150"
                  />
                  <span className="text-white text-base">{item.name}</span>
                </div>
                  <button className="bg-transparent border-none cursor-pointer p-1 min-w-[44px] min-h-[44px] flex items-center justify-center hover:text-indigo-400 transition-colors" onClick={(e) => { e.stopPropagation(); toggleStarred(item.id, item.starred !== 1); }}>
                  {item.starred === 1 ? '★' : '☆'}
                </button>
              </div>
            ))}
            {items.filter((i) => i.completed === 1).length > 0 && (
              <div className="mt-6">
                <button className="bg-[#17171e] border border-[#3a3a3e] text-indigo-500 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 hover:bg-[#2a2a2e] transition-colors" onClick={() => setCompletedExpanded(!completedExpanded)}>
                  {completedExpanded ? '▲' : '▼'} Slutfört
                </button>
                {completedExpanded && (
                  <div className="mt-3 space-y-2">
                    {items.filter((i) => i.completed === 1).sort((a, b) => (b.starred || 0) - (a.starred || 0)).map((item) => (
                      <div key={item.id} className={`${card} p-3 flex items-center justify-between gap-3 opacity-70`}>
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={true}
                            onChange={() => toggleItem(item.id, false)}
                            className="w-5 h-5 shrink-0 rounded-full appearance-none border-2 border-indigo-500 bg-indigo-600 checked:bg-indigo-600 transition-all duration-150"
                          />
                          <span className="line-through text-slate-500 text-sm">{item.name}</span>
                        </div>
                        <button className="bg-transparent border-none text-indigo-400 cursor-pointer p-1 min-w-[40px] min-h-[40px] flex items-center justify-center hover:bg-[#17171e] transition-colors" onClick={(e) => { e.stopPropagation(); toggleStarred(item.id, item.starred !== 1); }}>
                          {item.starred === 1 ? '★' : '☆'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {items.length === 0 && <div className="px-6 py-10 text-center text-slate-500 text-sm">Inga uppgifter än. Lägg till en ovan! 🛒</div>}
          </div>
        </div>
        <div className="fixed inset-x-0 bottom-0 w-full bg-[#0a0a0a] border-t border-[#2a2a2e] pt-4 pb-[calc(20px+env(safe-area-inset-bottom))] px-4">
          <div className="flex items-center gap-2 px-4 py-3.5 bg-[#17171e] border border-[#3a3a3e] rounded-xl">
            <button type="button" onClick={addItem} className="text-indigo-400 font-bold text-xl shrink-0">+</button>
            <input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} onKeyPress={(e) => { if (e.key === 'Enter') addItem(); }} placeholder="Lägg till en uppgift" className="flex-1 bg-transparent text-white text-base outline-none" />
          </div>
        </div>
      </div>
    );
  }

  if (view === 'detail' && detailItem) {
    return (
      <div className={page}>
        <div className="flex justify-between items-center mb-6 mt-2 px-2">
          <div className="flex items-center gap-3">
            <button className="bg-transparent border-none text-indigo-500 font-bold text-sm p-2 min-w-[40px] min-h-[40px] rounded-xl hover:bg-[#17171e] transition-colors" onClick={() => { setDetailItem(null); setView('items'); }}>&lt;</button>
          </div>
          <h1 className="mb-0 mt-0 text-sm font-bold text-white tracking-tight">{detailItem.name}</h1>
        </div>
        <div className={`${card} p-5 px-4 mt-6 shadow-xl max-w-[440px] w-full`}>
          <p className="mt-0 text-xs text-slate-400">Skapad: {new Date(detailItem.created_at).toLocaleString('sv-SE')}</p>
          {detailItem.created_by && <p className="mt-2 text-xs text-slate-500">Skapad av: {detailItem.created_by}</p>}
        </div>
      </div>
    );
  }

  return <div />;
}

export default App;
