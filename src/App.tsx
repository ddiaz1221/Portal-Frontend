import { useState, useEffect } from 'react';
import type { SubmitEvent } from 'react';

interface UserSession {
  id: string;
  username: string;
  email: string;
}

interface NoteItem {
  _id: string;
  sender: {
    _id: string;
    username: string;
  };
  receiver: string;
  content: string;
  status: 'inbox' | 'saved' | 'trash';
  createdAt: string;
}

function App() {
  const [isLoginView, setIsLoginView] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loggedInUser, setLoggedInUser] = useState<UserSession | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'saved' | 'trash' | 'settings'>('home');

  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [trashNotes, setTrashNotes] = useState<NoteItem[]>([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [noteMessage, setNoteMessage] = useState('');

  // --- NEW STATE FIELDS: For account management inputs ---
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');
  const [settingsError, setSettingsError] = useState(false);

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  })

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'light'){
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const savedToken = localStorage.getItem('userToken');
    const savedUser = localStorage.getItem('userData');
    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setLoggedInUser(parsedUser);
        setEditUsername(parsedUser.username); // Hydrate setting form input text
      } catch (error) {
        localStorage.clear();
      }
    }
  }, []);

  useEffect(() => {
    if (loggedInUser) {
      if (activeTab === 'home'){
        fetchInboxMessage();
      } else if (activeTab === 'saved') {
        fetchUserNotes();
      } else if (activeTab === 'trash') {
        fetchTrashNotes();
      }
    }
  }, [activeTab, loggedInUser]);

  const fetchInboxMessage = async () => {
    try {
      const token = localStorage.getItem('userToken');
      const response = await fetch('https://portal-backend-1m3j.onrender.com/api/notes?status=inbox', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json();
      if (response.ok){
        setNotes(data);
      }
    } catch (error){
      console.error('Error loading inbox notes:', error);
    }
  }

  const sendNewNote = async (receiverUsername: string, content: string) => {
    try {
      const token = localStorage.getItem('userToken');
      const response = await fetch('https://portal-backend-1m3j.onrender.com/api/notes/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ receiverUsername, content })
      });
      const data = await response.json();
      
      if (response.ok) {
        setNoteMessage('Note sent successfully!');
        setNewNoteContent('');
        fetchInboxMessage(); 
      } else {
        setNoteMessage(data.message || 'Failed to send note.');
      }
    } catch (error) {
      setNoteMessage('Server error sending note.');
    }
  };

  const updateNoteStatus = async (noteId: string, targetStatus: 'saved' | 'trash') => {
    try {
      const token = localStorage.getItem('userToken');
      const response = await fetch(`https://portal-backend-1m3j.onrender.com/api/notes/${noteId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: targetStatus })
      });
      
      if (response.ok) {
        setNotes((prevNotes) => prevNotes.filter(note => note._id !== noteId));
      }
    } catch (error) {
      console.error(`Error moving note to ${targetStatus}:`, error);
    }
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev == 'dark' ? 'light' : 'dark'));
  }

  const fetchUserNotes = async () => {
    if (!loggedInUser) return;
    try {
      const response = await fetch(`https://portal-backend-lm3j.onrender.com/api/notes/${loggedInUser.id}`);
      if (response.ok) {
        const data = await response.json();
        setNotes(data);
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
    }
  };

  const fetchTrashNotes = async () => {
    if (!loggedInUser) return;
    try {
      const response = await fetch(`https://portal-backend-lm3j.onrender.com/api/notes/trash/${loggedInUser.id}`);
      if (response.ok) {
        const data = await response.json();
        setTrashNotes(data);
      }
    } catch (error) {
      console.error('Error fetching trash:', error);
    }
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim() || !loggedInUser) return;

    try {
      const response = await fetch('https://portal-backend-lm3j.onrender.com/api/notes/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: loggedInUser.id,
          content: newNoteContent
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setNewNoteContent('');
        fetchUserNotes();
      } else {
        setNoteMessage(`Failed to save: ${data.message}`);
      }
    } catch (error) {
      console.error('Network error saving note:', error);
      setNoteMessage('Could not connect to server.');
    }
  };

  const handleSoftDelete = async (noteId: string) => {
    try {
      const response = await fetch(`https://portal-backend-lm3j.onrender.com/api/notes/status/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDeleted: true })
      });
      if (response.ok) {
        fetchUserNotes();
      }
    } catch (error) {
      console.error('Error trashing note:', error);
    }
  };

  const handleRestoreNote = async (noteId: string) => {
    try {
      const response = await fetch(`https://portal-backend-lm3j.onrender.com/api/notes/status/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDeleted: false })
      });
      if (response.ok) {
        fetchTrashNotes();
      }
    } catch (error) {
      console.error('Error restoring note:', error);
    }
  };

  const handlePermanentDelete = async (noteId: string) => {
    if (!window.confirm('Are you absolutely sure you want to permanently delete this note?')) return;
    try {
      const response = await fetch(`https://portal-backend-lm3j.onrender.com/api/notes/purge/${noteId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        fetchTrashNotes();
      }
    } catch (error) {
      console.error('Error purging note:', error);
    }
  };

  // --- NEW: Change Username Form Action ---
  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggedInUser || !editUsername.trim()) return;

    try {
      const response = await fetch(`https://portal-backend-lm3j.onrender.com/api/users/update-username/${loggedInUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newUsername: editUsername })
      });
      const data = await response.json();

      if (response.ok) {
        setSettingsError(false);
        setSettingsMessage('Username updated successfully!');
        
        // Synchronize state and browser LocalStorage with new username mapping
        const updatedSession = { ...loggedInUser, username: data.username };
        localStorage.setItem('userData', JSON.stringify(updatedSession));
        setLoggedInUser(updatedSession);
      } else {
        setSettingsError(true);
        setSettingsMessage(data.message || 'Failed to update username.');
      }
    } catch (error) {
      setSettingsError(true);
      setSettingsMessage('Network error occurred.');
    }
  };

  // --- NEW: Change Password Form Action ---
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggedInUser || !editPassword) return;

    try {
      const response = await fetch(`https://portal-backend-lm3j.onrender.com/api/users/update-password/${loggedInUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: editPassword })
      });
      const data = await response.json();

      if (response.ok) {
        setSettingsError(false);
        setSettingsMessage('Password updated successfully!');
        setEditPassword(''); // Clear state buffer input out
      } else {
        setSettingsError(true);
        setSettingsMessage(data.message || 'Failed to update password.');
      }
    } catch (error) {
      setSettingsError(true);
      setSettingsMessage('Network error occurred.');
    }
  };

  // --- NEW: Permanent Account Purge Deletion Action ---
  const handleDeleteAccount = async () => {
    if (!loggedInUser) return;
    
    const firstCheck = window.confirm('⚠️ WARNING: Are you sure you want to permanently delete your account? All saved data will be wiped out completely.');
    if (!firstCheck) return;

    const finalDoubleCheck = window.confirm('🚨 FINAL ACTION CHECK: This is your absolute last warning. This process is irreversible. Erase your account forever?');
    if (!finalDoubleCheck) return;

    try {
      const response = await fetch(`https://portal-backend-lm3j.onrender.com/api/users/delete-account/${loggedInUser.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        alert('Your account has been deleted successfully.');
        handleLogout(); // Fire immediate client cleanup log out flow
      } else {
        alert('Failed to delete account. Try again later.');
      }
    } catch (error) {
      console.error('Account removal network fail:', error);
    }
  };

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage('Connecting to backend...');

    const endpoint = isLoginView 
      ? 'https://portal-backend-lm3j.onrender.com/api/users/login'
      : 'https://portal-backend-lm3j.onrender.com/api/users/register';

    const payload = isLoginView 
      ? { email, password } 
      : { username, email, password };
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        if (isLoginView) {
          setMessage('');
          const userSessionData = {
            id: data.user.id,
            username: data.user.username,
            email: data.user.email
          };

          localStorage.setItem('userToken', data.token);
          localStorage.setItem('userData', JSON.stringify(userSessionData));
          setLoggedInUser(userSessionData);
          setEditUsername(data.user.username); // Hydrate inputs
          setEmail('');
          setPassword('');
        } else {
          setMessage(`Account created successfully! Switch to login to sign in.`);
          setUsername('');
          setEmail('');
          setPassword('');
        }
      } else {
        setMessage(`Error: ${data.message || 'Action failed'}`);
      }
    } catch (error) {
      console.error('Network Error:', error);
      setMessage('Could not connect to the backend server.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userData');
    setLoggedInUser(null);
    setActiveTab('home');
    setNotes([]);
    setTrashNotes([]);
    setSettingsMessage('');
    setMessage('Logged out successfully.');
  };

  if (loggedInUser) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col font-sans">
        
        {/* HEADER BAR */}
        <header className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 shadow-md flex justify-between items-center z-10">
          {/* CLICKABLE BRAND TITLE */}
          <button 
              onClick={() => setActiveTab('home')}
              className="text-xl font-black text-white tracking-wider uppercase hover:opacity-90 transition-all focus:outline-none"
            >
            Portal
          </button>
  
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2.5 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
              <div className="h-7 w-7 bg-white text-blue-600 font-bold text-xs rounded-full flex items-center justify-center shadow-inner">
                {loggedInUser.username.substring(0, 2).toUpperCase()}
              </div>
              <span className="text-white text-sm font-semibold tracking-wide hidden sm:inline">
                {loggedInUser.username}
              </span>
            </div>
            <button 
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-xl text-xs tracking-wide transition-all shadow-md transform active:scale-95"
              >
              Sign Out
            </button>
          </div>
        </header>

        {/* WORKSPACE AREA */}
        <div className="flex flex-1 flex-col md:flex-row">
          
          {/* NAVIGATION SIDEBAR */}
          <aside className="w-full md:w-64 bg-white border-r border-gray-200 flex flex-row md:flex-col p-3 md:p-4 gap-1 md:space-y-1 overflow-x-auto md:overflow-x-visible">
            <button onClick={() => setActiveTab('home')} className={`flex-1 md:flex-none flex items-center justify-center md:justify-start space-x-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'home' ? 'bg-blue-50 text-blue-600 border border-blue-100/50 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}>
              <span>🏠 Home View</span>
            </button>
            <button onClick={() => setActiveTab('saved')} className={`flex-1 md:flex-none flex items-center justify-center md:justify-start space-x-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'saved' ? 'bg-blue-50 text-blue-600 border border-blue-100/50 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}>
              <span>⭐ Saved Items</span>
            </button>
            <button onClick={() => setActiveTab('trash')} className={`flex-1 md:flex-none flex items-center justify-center md:justify-start space-x-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'trash' ? 'bg-blue-50 text-blue-600 border border-blue-100/50 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}>
              <span>🗑️ Trash bin</span>
            </button>
            <button onClick={() => setActiveTab('settings')} className={`flex-1 md:flex-none flex items-center justify-center md:justify-start space-x-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'settings' ? 'bg-blue-50 text-blue-600 border border-blue-100/50 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}>
              <span>⚙️ Account Settings</span>
            </button>
          </aside>

          {/* DYNAMIC VIEWS MAIN PANEL */}
          <main className="flex-1 p-6 md:p-8 overflow-y-auto">
            
           {activeTab === 'home' && (
              <div className="space-y-6 max-w-4xl mx-auto">
                {/* Welcome Banner */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
                  <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 mb-2">Welcome Home, {loggedInUser.username}! 👋</h2>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">This is your main centralized messaging and network dashboard command panel.</p>
                </div>
    
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Left Column: Send Form */}
                  <div className="flex-1 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 h-fit">
                    <h3 className="text-lg font-black text-gray-800 dark:text-gray-100 mb-4">Send a New Note</h3>
        
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const recipient = formData.get('recipientUsername') as string;
                      const msg = formData.get('noteText') as string;
                      sendNewNote(recipient, msg);
                      e.currentTarget.reset();
                    }} className="space-y-4">
          
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Recipient Username</label>
                        <input 
                          name="recipientUsername" 
                          type="text" 
                          required 
                          placeholder="Enter user..." 
                          className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-4 py-2 rounded-xl text-gray-800 dark:text-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Message Content</label>
                        <textarea 
                          name="noteText" 
                          required 
                          rows={4} 
                          placeholder="Type a secure note..." 
                          className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-4 py-2 rounded-xl text-gray-800 dark:text-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                      </div>

                      <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs tracking-wide transition-all shadow-md">
                        Send Note
                      </button>
                    </form>
                    {noteMessage && <p className="text-xs font-semibold text-blue-500 mt-3 text-center">{noteMessage}</p>}
                  </div>

                  {/* Right Column: Inbox Feed */}
                  <div className="flex-[2] space-y-4">
                    <h3 className="text-lg font-black text-gray-800 dark:text-gray-100">Your Incoming Inbox</h3>
        
                    {notes.length === 0 ? (
                      <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl border border-gray-200 dark:border-gray-700 text-center">
                        <p className="text-gray-400 text-sm font-medium">No system transmission notes received yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {notes.map((note) => (
                          <div key={note._id} className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm transition-all">
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-xs font-bold bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-lg">
                                From: @{note.sender?.username || 'unknown'}
                              </span>
                              <span className="text-[10px] text-gray-400 font-mono">
                                {new Date(note.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                
                            <p className="text-sm text-gray-700 dark:text-gray-300 my-3 font-medium whitespace-pre-wrap">{note.content}</p>
                
                            <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                              <button 
                                onClick={() => updateNoteStatus(note._id, 'saved')}
                                className="text-xs font-bold border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 py-1.5 px-4 rounded-xl transition-all"
                              >
                                Save to Archive
                              </button>
                              <button 
                                onClick={() => updateNoteStatus(note._id, 'trash')}
                                className="text-xs font-bold border border-red-100 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 py-1.5 px-4 rounded-xl transition-all"
                              >
                                Move to Trash
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'saved' && (
              <div className="space-y-6 max-w-3xl">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                  <h2 className="text-2xl font-black text-gray-800 mb-1">Saved Snippets & Notes</h2>
                  <p className="text-gray-500 text-sm">Create and store text snippets directly under your unique account ID record inside MongoDB Atlas.</p>
                </div>

                <form onSubmit={handleSaveNote} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-3">
                  <textarea value={newNoteContent} onChange={(e) => setNewNoteContent(e.target.value)} placeholder="Type something down to save to the database..." required rows={3} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm text-gray-800 resize-none" />
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400 font-medium">Linked to: {loggedInUser.username}</span>
                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded-xl text-sm transition-all shadow-sm transform active:scale-98">Save to MongoDB</button>
                  </div>
                  {noteMessage && <p className="text-xs text-red-500 mt-1">{noteMessage}</p>}
                </form>

                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Your Saved Database Records ({notes.length})</h3>
                  {notes.length === 0 ? (
                    <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center text-gray-400 text-sm font-medium">No database entries found for this account. Create one above!</div>
                  ) : (
                    notes.map((note) => (
                      <div key={note._id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 relative group transition-all hover:shadow-md flex justify-between items-start space-x-4">
                        <div className="flex-1">
                          <p className="text-gray-800 text-sm whitespace-pre-wrap font-medium">{note.content}</p>
                          <div className="mt-3 flex items-center justify-between text-[11px] text-gray-400 border-t border-gray-50 pt-3">
                            <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-500">Doc ID: {note._id}</span>
                            <span>{new Date(note.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                        <button onClick={() => handleSoftDelete(note._id)} className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-all font-semibold text-xs flex items-center space-x-1" title="Move to Trash">🗑️</button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'trash' && (
              <div className="space-y-6 max-w-3xl">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                  <h2 className="text-2xl font-black text-gray-800 mb-2">Trash Bin</h2>
                  <p className="text-gray-600 text-sm">Deleted records sit in safety storage here before complete database purging.</p>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Trashed Records ({trashNotes.length})</h3>
                  {trashNotes.length === 0 ? (
                    <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center text-gray-400 text-sm font-medium">The trash container is completely empty.</div>
                  ) : (
                    trashNotes.map((note) => (
                      <div key={note._id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex justify-between items-start space-x-4">
                        <div className="flex-1">
                          <p className="text-gray-500 line-through text-sm whitespace-pre-wrap font-medium">{note.content}</p>
                          <div className="mt-3 flex items-center justify-between text-[11px] text-gray-400 border-t border-gray-50 pt-3">
                            <span className="font-mono bg-gray-50 px-2 py-0.5 rounded text-gray-400">Doc ID: {note._id}</span>
                            <span>{new Date(note.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <button onClick={() => handleRestoreNote(note._id)} className="bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-700 font-bold px-2.5 py-1.5 rounded-xl text-xs transition-all">🔄 Restore</button>
                          <button onClick={() => handlePermanentDelete(note._id)} className="bg-gray-100 hover:bg-red-500 text-gray-600 hover:text-white font-bold px-2.5 py-1.5 rounded-xl text-xs transition-all">💥 Purge</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* --- UPGRADED: LIVE INTERACTIVE ACCOUNT SETTINGS ENGINE --- */}
            {activeTab === 'settings' && (
            <div className="space-y-6 max-w-2xl">
              {/* Combined Tailwind layout with CSS Variable inline styling */}
              <div 
                className="p-6 rounded-2xl shadow-sm border transition-all"
                style={{ 
                  backgroundColor: 'var(--bg-secondary)', 
                  borderColor: 'var(--border-color)' 
                }}
              >
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div>
                    <h2 className="text-2xl font-black mb-1" style={{ color: 'var(--text-primary)' }}>
                      Account Control Center
                    </h2>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      Manage your profile registration criteria, security keys, or delete your file nodes entirely.
                    </p>
                  </div>
        
                  {/* Theme Toggle Button */}
                  <button 
                    type="button"
                    onClick={toggleTheme}
                    className="self-start sm:self-center font-bold py-2 px-4 rounded-xl text-xs tracking-wide transition-all shadow-sm shrink-0"
                    style={{
                      backgroundColor: theme === 'light' ? '#111827' : '#ffffff',
                      color: theme === 'light' ? '#ffffff' : '#111827'
                    }}
                  >
                    {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
                  </button>
                </div>
              </div>

              {/* Info feedback bar */}
              {settingsMessage && (
                <div className={`p-4 rounded-xl text-sm font-bold border ${settingsError ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                  {settingsMessage}
                </div>
              )}

              {/* Main Settings Card */}
              <div 
                className="p-6 rounded-2xl shadow-sm border space-y-6 transition-all"
                style={{ 
                backgroundColor: 'var(--bg-secondary)', 
                borderColor: 'var(--border-color)' 
              }}
            >
              {/* Read-Only Email Block */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Registered Email Connection
                </label>
                <input 
                  type="text" 
                  disabled 
                  value={loggedInUser.email} 
                  className="w-full border px-4 py-2.5 rounded-xl font-mono font-medium cursor-not-allowed text-sm" 
                  style={{ 
                    backgroundColor: 'var(--bg-primary)', 
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-secondary)'
                  }}
                />
              </div>

              <hr style={{ borderColor: 'var(--border-color)' }} />

              {/* Change Username Module Form */}
              <form onSubmit={handleUpdateUsername} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Update Account Username
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input 
                      type="text" 
                      value={editUsername} 
                      onChange={(e) => setEditUsername(e.target.value)} 
                      required 
                      className="flex-1 border px-4 py-2 rounded-xl font-semibold text-sm outline-none" 
                      style={{ 
                        backgroundColor: 'var(--bg-primary)', 
                        borderColor: 'var(--border-color)',
                        color: 'var(--text-primary)'
                      }}
                      placeholder="New username" 
                    />
                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded-xl text-xs transition-all shadow-sm">
                      Save Username
                    </button>
                  </div>
                </div>
              </form>

              <hr style={{ borderColor: 'var(--border-color)' }} />

              {/* Change Password Module Form */}
              <form onSubmit={handleUpdatePassword} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Update Account Security Password
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input 
                      type="password" 
                      value={editPassword} 
                      onChange={(e) => setEditPassword(e.target.value)} 
                      required 
                      minLength={6} 
                      className="flex-1 border px-4 py-2 rounded-xl font-semibold text-sm outline-none" 
                      style={{ 
                        backgroundColor: 'var(--bg-primary)', 
                        borderColor: 'var(--border-color)',
                        color: 'var(--text-primary)'
                      }}
                      placeholder="Enter new secret password (min 6 chars)" 
                    />
                    <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-5 rounded-xl text-xs transition-all shadow-sm">
                      Change Password
                    </button>
                  </div>
                </div>
              </form>

              <hr style={{ borderColor: 'var(--border-color)' }} />

              {/* Danger Zone */}
              <div className="bg-red-50/50 dark:bg-red-950/20 p-5 rounded-2xl border border-red-100/60 dark:border-red-900/40 space-y-3">
                <div className="text-left">
                  <h3 className="text-sm font-black text-red-800 dark:text-red-400 uppercase tracking-wide">Danger Zone</h3>
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium mt-0.5">Permanently close and purge this portal profile row from the central server array completely.</p>
                </div>
                <button type="button" onClick={handleDeleteAccount} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs tracking-wide transition-all shadow-md transform active:scale-98">
                  Permanently Delete Account
                </button>
              </div>

            </div>
          </div>
        )}

          </main>
        </div>
      </div>
    );
  }

  // AUTHPORTAL VIEW
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
        <h2 className="text-3xl font-extrabold text-center text-gray-900 mb-8 tracking-tight">{isLoginView ? 'Sign In' : 'Create Account'}</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLoginView && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-900 text-sm" placeholder="johndoe" />
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-900 text-sm" placeholder="you@example.com" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-900 text-sm" placeholder="••••••••" />
          </div>
          <button type="submit" className="w-full mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-md hover:shadow-lg transition-all transform active:scale-[0.98] text-sm">
            {isLoginView ? 'Sign In' : 'Register Now'}
          </button>
        </form>
        <div className="mt-6 text-center">
          <button onClick={() => { setIsLoginView(!isLoginView); setMessage(''); }} className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline transition-all">
            {isLoginView ? "Don't have an account? Register here" : "Already have an account? Login here"}
          </button>
        </div>
        {message && <div className="mt-5 p-3 rounded-xl bg-blue-50 border border-blue-100 text-center text-sm font-medium text-blue-700">{message}</div>}
      </div>
    </div>
  );
}

export default App;