import React, { useState, useEffect, useCallback } from 'react';
import { 
  AdminAccount, 
  CurrentUser, 
  Freelancer, 
  Member, 
  ToastMessage, 
  WaLead 
} from './types';
import { 
  dbProxy, 
  getWaConfig, 
  saveWaConfig, 
  loginAdminApi, 
  loginMemberApi, 
  fetchAdminsApi, 
  createAdminApi, 
  deleteAdminApi, 
  uploadFreelancerImagesToStorage 
} from './api';
import { ToastContainer } from './components/Toast';
import { Navbar } from './components/Navbar';
import { LoginView } from './components/LoginView';
import { CatalogView } from './components/CatalogView';
import { DetailView } from './components/DetailView';
import { AdminView } from './components/AdminView';
import { 
  AdminLoginModal, 
  ContactWaModal, 
  EditWaModal, 
  LightboxModal 
} from './components/Modals';

export default function App() {
  // Navigation & User State
  const [currentView, setCurrentView] = useState<'login' | 'catalog' | 'detail' | 'admin'>('login');
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  // Data Collections
  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [waLeads, setWaLeads] = useState<WaLead[]>([]);
  const [adminWa, setAdminWa] = useState<string>('6285111029242');

  // Interactive Selection
  const [selectedTalent, setSelectedTalent] = useState<Freelancer | null>(null);

  // Loading States
  const [catalogLoading, setCatalogLoading] = useState<boolean>(false);
  const [adminLoginLoading, setAdminLoginLoading] = useState<boolean>(false);
  const [memberLoginLoading, setMemberLoginLoading] = useState<boolean>(false);

  // Modals
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);
  const [isContactWaModalOpen, setIsContactWaModalOpen] = useState<boolean>(false);
  const [isEditWaModalOpen, setIsEditWaModalOpen] = useState<boolean>(false);
  const [lightbox, setLightbox] = useState<{
    isOpen: boolean;
    images: string[];
    currentIndex: number;
  }>({
    isOpen: false,
    images: [],
    currentIndex: 0
  });

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Fetch Freelancers from DB Proxy
  const loadFreelancers = useCallback(async () => {
    setCatalogLoading(true);
    const res = await dbProxy.select<Freelancer>('freelancers');
    if (res.data && Array.isArray(res.data)) {
      setFreelancers(res.data);
    } else {
      setFreelancers([]);
      if (res.error) {
        console.warn('Gagal memuat talenta:', res.error.message);
      }
    }
    setCatalogLoading(false);
  }, []);

  // Fetch Admin-only Data Collections
  const loadAdminData = useCallback(async () => {
    const [adminList, membersRes, leadsRes] = await Promise.all([
      fetchAdminsApi(),
      dbProxy.select<Member>('members'),
      dbProxy.select<WaLead>('wa_leads', { order: 'created_at', ascending: false })
    ]);

    setAdmins(adminList);
    if (membersRes.data && Array.isArray(membersRes.data)) {
      setMembers(membersRes.data);
    }
    if (leadsRes.data && Array.isArray(leadsRes.data)) {
      setWaLeads(leadsRes.data);
    }
  }, []);

  // Initial Load: WhatsApp config, Session recovery, Freelancers list
  useEffect(() => {
    // 1. WhatsApp number
    getWaConfig().then((num) => {
      if (num) setAdminWa(num);
    });

    // 2. Freelancers
    loadFreelancers();

    // 3. Check existing user session
    try {
      const savedUser = localStorage.getItem('currentUser');
      const savedAdminSession = localStorage.getItem('supabase_admin_session');

      if (savedAdminSession) {
        const parsed = JSON.parse(savedAdminSession);
        if (parsed && (parsed.access_token || parsed.token)) {
          const email = parsed.user?.email || 'admin@prossindo.com';
          const name = parsed.user?.name || parsed.user?.username || email.split('@')[0];
          const adminUser: CurrentUser = {
            role: 'admin',
            email,
            username: parsed.user?.username || email.split('@')[0],
            name
          };
          setCurrentUser(adminUser);
          setCurrentView('catalog');
          loadAdminData();
          return;
        }
      }

      if (savedUser) {
        const parsedUser: CurrentUser = JSON.parse(savedUser);
        if (parsedUser && parsedUser.username) {
          setCurrentUser(parsedUser);
          setCurrentView('catalog');
        }
      }
    } catch (e) {
      console.warn('Error reading stored session:', e);
    }
  }, [loadFreelancers, loadAdminData]);

  // Handle Member Login
  const handleMemberLogin = async (username: string) => {
    setMemberLoginLoading(true);
    const res = await loginMemberApi(username);
    setMemberLoginLoading(false);

    if (res.success && res.member) {
      const userObj: CurrentUser = {
        role: 'member',
        username: res.member.username,
        name: res.member.name || res.member.username
      };
      setCurrentUser(userObj);
      localStorage.setItem('currentUser', JSON.stringify(userObj));
      setCurrentView('catalog');
      addToast(`Selamat datang, ${userObj.name}!`, 'success');
    } else {
      addToast(res.message || 'Gagal masuk member.', 'error');
    }
  };

  // Handle Super Admin Login
  const handleAdminLogin = async (identifier: string, pass: string): Promise<boolean> => {
    setAdminLoginLoading(true);
    const res = await loginAdminApi(identifier, pass);
    setAdminLoginLoading(false);

    if (res.success && res.session) {
      const user = res.session.user;
      const adminUser: CurrentUser = {
        role: 'admin',
        email: user.email,
        username: user.username || user.email.split('@')[0],
        name: user.name || user.email.split('@')[0]
      };
      setCurrentUser(adminUser);
      localStorage.setItem('currentUser', JSON.stringify(adminUser));
      localStorage.setItem('supabase_admin_session', JSON.stringify(res.session));

      setIsAdminModalOpen(false);
      setCurrentView('admin');
      addToast('Autentikasi Super Admin berhasil. Selamat bekerja!', 'success');
      loadAdminData();
      return true;
    } else {
      addToast(res.message || 'Login admin gagal.', 'error');
      return false;
    }
  };

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('supabase_admin_session');
    setCurrentUser(null);
    setSelectedTalent(null);
    setCurrentView('login');
    addToast('Anda telah berhasil keluar.', 'info');
  };

  // Handle Save Freelancer (Uploads images to Supabase Storage bucket 'freelancer-images')
  const handleSaveFreelancer = async (data: {
    id?: number | string;
    name: string;
    location: string;
    status: string;
    service: string;
    description: string;
    existingImages: string[];
    newImageFiles: Array<{ image: string; name?: string }>;
  }): Promise<boolean> => {
    try {
      let finalImages: string[] = [...data.existingImages];

      // Upload new images to Supabase Storage bucket 'freelancer-images'
      if (data.newImageFiles && data.newImageFiles.length > 0) {
        addToast('Mengunggah gambar ke Supabase Storage...', 'info');
        const uploadRes = await uploadFreelancerImagesToStorage(data.newImageFiles);
        if (!uploadRes.success) {
          addToast(`Gagal unggah foto: ${uploadRes.message}`, 'error');
          return false;
        }
        finalImages = [...finalImages, ...uploadRes.urls];
      }

      const payload = {
        name: data.name,
        location: data.location,
        status: data.status,
        service: data.service,
        description: data.description,
        images: finalImages
      };

      if (data.id) {
        // Update existing freelancer
        const res = await dbProxy.update('freelancers', payload, { id: data.id });
        if (res.error) {
          addToast(`Gagal memperbarui talenta: ${res.error.message}`, 'error');
          return false;
        }
        addToast(`Data talenta "${data.name}" berhasil diperbarui!`, 'success');
      } else {
        // Insert new freelancer
        const res = await dbProxy.insert('freelancers', payload);
        if (res.error) {
          addToast(`Gagal menyimpan talenta: ${res.error.message}`, 'error');
          return false;
        }
        addToast(`Talenta baru "${data.name}" berhasil ditambahkan ke katalog!`, 'success');
      }

      await loadFreelancers();
      return true;
    } catch (err: any) {
      addToast(`Terjadi kesalahan: ${err.message}`, 'error');
      return false;
    }
  };

  // Handle Delete Freelancer
  const handleDeleteFreelancer = async (id: number | string): Promise<boolean> => {
    const res = await dbProxy.delete('freelancers', { id });
    if (res.success || !res.error) {
      addToast('Talenta berhasil dihapus dari database.', 'success');
      setFreelancers((prev) => prev.filter((f) => String(f.id) !== String(id)));
      return true;
    }
    addToast(`Gagal menghapus: ${res.error?.message || 'Kesalahan server'}`, 'error');
    return false;
  };

  // Handle Create Super Admin
  const handleCreateAdmin = async (adminData: {
    email: string;
    password: string;
    name: string;
    username: string;
  }): Promise<boolean> => {
    const res = await createAdminApi(adminData);
    if (res.success) {
      addToast(`Akun Super Admin "${adminData.email}" berhasil dibuat di Supabase!`, 'success');
      const updated = await fetchAdminsApi();
      setAdmins(updated);
      return true;
    }
    addToast(res.message || 'Gagal membuat akun admin.', 'error');
    return false;
  };

  // Handle Delete Super Admin
  const handleDeleteAdmin = async (id: number | string): Promise<boolean> => {
    const res = await deleteAdminApi(id);
    if (res.success) {
      addToast('Akun admin berhasil dihapus.', 'success');
      const updated = await fetchAdminsApi();
      setAdmins(updated);
      return true;
    }
    addToast(res.message || 'Gagal menghapus akun admin.', 'error');
    return false;
  };

  // Handle Create Member
  const handleCreateMember = async (username: string, name: string): Promise<boolean> => {
    const res = await dbProxy.insert('members', [{ username, name }]);
    if (res.data || !res.error) {
      addToast(`Member "${username}" berhasil ditambahkan!`, 'success');
      const membersRes = await dbProxy.select<Member>('members');
      if (membersRes.data && Array.isArray(membersRes.data)) {
        setMembers(membersRes.data);
      }
      return true;
    }
    addToast(`Gagal menambah member: ${res.error?.message}`, 'error');
    return false;
  };

  // Handle Delete Member
  const handleDeleteMember = async (username: string): Promise<boolean> => {
    const res = await dbProxy.delete('members', { username });
    if (res.success || !res.error) {
      addToast(`Member "${username}" berhasil dihapus.`, 'success');
      setMembers((prev) => prev.filter((m) => m.username !== username));
      return true;
    }
    addToast(`Gagal menghapus member: ${res.error?.message}`, 'error');
    return false;
  };

  // Handle Log WA Lead
  const handleLogLead = async (leadData: {
    member_name: string;
    talent_name: string;
    service: string;
    reference: string;
  }) => {
    const res = await dbProxy.insert('wa_leads', [leadData]);
    if (res.data && Array.isArray(res.data)) {
      setWaLeads((prev) => [...(res.data as WaLead[]), ...prev]);
    } else {
      // Background silent refresh
      dbProxy.select<WaLead>('wa_leads', { order: 'created_at', ascending: false })
        .then((r) => {
          if (r.data && Array.isArray(r.data)) setWaLeads(r.data);
        });
    }
  };

  // Handle Delete Lead
  const handleDeleteLead = async (id: number | string): Promise<boolean> => {
    const res = await dbProxy.delete('wa_leads', { id });
    if (res.success || !res.error) {
      addToast('Riwayat lead berhasil dihapus.', 'success');
      setWaLeads((prev) => prev.filter((l) => String(l.id) !== String(id)));
      return true;
    }
    addToast('Gagal menghapus riwayat lead.', 'error');
    return false;
  };

  // Handle Save WhatsApp Configuration
  const handleSaveWaConfig = async (newWa: string): Promise<boolean> => {
    const ok = await saveWaConfig(newWa);
    if (ok) {
      setAdminWa(newWa);
      addToast('Nomor WhatsApp Admin berhasil diperbarui di database!', 'success');
      return true;
    }
    addToast('Gagal memperbarui nomor WhatsApp di server.', 'error');
    return false;
  };

  // Lightbox Navigation
  const handleOpenLightbox = (images: string[], index: number) => {
    setLightbox({
      isOpen: true,
      images,
      currentIndex: index
    });
  };

  const handleLightboxPrev = () => {
    setLightbox((prev) => ({
      ...prev,
      currentIndex: prev.currentIndex > 0 ? prev.currentIndex - 1 : prev.images.length - 1
    }));
  };

  const handleLightboxNext = () => {
    setLightbox((prev) => ({
      ...prev,
      currentIndex: prev.currentIndex < prev.images.length - 1 ? prev.currentIndex + 1 : 0
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Top Navbar */}
      <Navbar
        currentUser={currentUser}
        currentView={currentView}
        onChangeView={(view) => {
          if (view === 'catalog') setSelectedTalent(null);
          setCurrentView(view);
        }}
        onLogout={handleLogout}
      />

      {/* Main Content Areas based on currentView */}
      <main className="flex-1">
        {currentView === 'login' && (
          <LoginView
            onMemberLogin={handleMemberLogin}
            onOpenAdminModal={() => setIsAdminModalOpen(true)}
            loading={memberLoginLoading}
          />
        )}

        {currentView === 'catalog' && (
          <CatalogView
            freelancers={freelancers}
            loading={catalogLoading}
            onSelectTalent={(talent) => {
              setSelectedTalent(talent);
              setCurrentView('detail');
            }}
            onContactWa={(talent) => {
              setSelectedTalent(talent);
              setIsContactWaModalOpen(true);
            }}
          />
        )}

        {currentView === 'detail' && selectedTalent && (
          <DetailView
            talent={selectedTalent}
            onBack={() => {
              setSelectedTalent(null);
              setCurrentView('catalog');
            }}
            onContactWa={(talent) => {
              setSelectedTalent(talent);
              setIsContactWaModalOpen(true);
            }}
            onOpenLightbox={handleOpenLightbox}
          />
        )}

        {currentView === 'admin' && currentUser && currentUser.role === 'admin' && (
          <AdminView
            currentUser={currentUser}
            freelancers={freelancers}
            members={members}
            admins={admins}
            waLeads={waLeads}
            adminWa={adminWa}
            loading={false}
            onSaveFreelancer={handleSaveFreelancer}
            onDeleteFreelancer={handleDeleteFreelancer}
            onCreateAdmin={handleCreateAdmin}
            onDeleteAdmin={handleDeleteAdmin}
            onCreateMember={handleCreateMember}
            onDeleteMember={handleDeleteMember}
            onDeleteLead={handleDeleteLead}
            onOpenEditWaModal={() => setIsEditWaModalOpen(true)}
            onRefreshLeads={loadAdminData}
          />
        )}
      </main>

      {/* Footer */}
      {currentView !== 'login' && (
        <footer className="border-t border-slate-200/80 bg-white py-6 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">PROSS INDO</span>
              <span>&bull;</span>
              <span>Direktori Talent & Partner Bisnis Terkurasi</span>
            </div>
            <div>
              <span>Penyimpanan Foto Supabase Storage &amp; Database Real-time</span>
            </div>
          </div>
        </footer>
      )}

      {/* Modals */}
      <AdminLoginModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        onLogin={handleAdminLogin}
        loading={adminLoginLoading}
      />

      <ContactWaModal
        isOpen={isContactWaModalOpen}
        onClose={() => setIsContactWaModalOpen(false)}
        talent={selectedTalent}
        adminWa={adminWa}
        defaultMemberName={currentUser?.name || currentUser?.username || 'Member'}
        onLogLead={handleLogLead}
      />

      <EditWaModal
        isOpen={isEditWaModalOpen}
        onClose={() => setIsEditWaModalOpen(false)}
        currentWa={adminWa}
        onSave={handleSaveWaConfig}
      />

      <LightboxModal
        isOpen={lightbox.isOpen}
        onClose={() => setLightbox((prev) => ({ ...prev, isOpen: false }))}
        images={lightbox.images}
        currentIndex={lightbox.currentIndex}
        onPrev={handleLightboxPrev}
        onNext={handleLightboxNext}
      />
    </div>
  );
}
