import React, { useState, useRef } from 'react';
import { AdminAccount, CurrentUser, Freelancer, Member, WaLead } from '../types';
import { 
  ShieldCheck, 
  Users, 
  Phone, 
  MessageCircle, 
  Plus, 
  Edit3, 
  Trash2, 
  UploadCloud, 
  X, 
  Save, 
  RotateCcw, 
  Loader2, 
  ExternalLink,
  CheckCircle2, 
  UserPlus,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

interface AdminViewProps {
  currentUser: CurrentUser;
  freelancers: Freelancer[];
  members: Member[];
  admins: AdminAccount[];
  waLeads: WaLead[];
  adminWa: string;
  loading: boolean;
  onSaveFreelancer: (data: {
    id?: number | string;
    name: string;
    location: string;
    status: string;
    service: string;
    description: string;
    existingImages: string[];
    newImageFiles: Array<{ image: string; name?: string }>;
  }) => Promise<boolean>;
  onDeleteFreelancer: (id: number | string) => Promise<boolean>;
  onCreateAdmin: (data: { email: string; password: string; name: string; username: string }) => Promise<boolean>;
  onDeleteAdmin: (id: number | string) => Promise<boolean>;
  onCreateMember: (username: string, name: string) => Promise<boolean>;
  onDeleteMember: (username: string) => Promise<boolean>;
  onDeleteLead: (id: number | string) => Promise<boolean>;
  onOpenEditWaModal: () => void;
  onRefreshLeads: () => Promise<void>;
  onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  currentUser,
  freelancers,
  members,
  admins,
  waLeads,
  adminWa,
  loading,
  onSaveFreelancer,
  onDeleteFreelancer,
  onCreateAdmin,
  onDeleteAdmin,
  onCreateMember,
  onDeleteMember,
  onDeleteLead,
  onOpenEditWaModal,
  onRefreshLeads,
  onShowToast
}) => {
  // Freelancer Form state
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState('Available');
  const [service, setService] = useState('');
  const [description, setDescription] = useState('');
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newImageFiles, setNewImageFiles] = useState<Array<{ image: string; name?: string }>>([]);
  const [savingFreelancer, setSavingFreelancer] = useState(false);

  // Admin Form state
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  // Member Form state
  const [newMemberUsername, setNewMemberUsername] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [creatingMember, setCreatingMember] = useState(false);

  const [refreshingLeads, setRefreshingLeads] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // State untuk Modal Konfirmasi Hapus yang aman dan ramah iframe
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    type: 'talent' | 'admin' | 'member' | 'lead';
    id: number | string;
    name: string;
  } | null>(null);
  const [deletingConfirm, setDeletingConfirm] = useState(false);

  const handleExecuteDelete = async () => {
    if (!deleteConfirmation) return;
    setDeletingConfirm(true);
    try {
      if (deleteConfirmation.type === 'talent') {
        await onDeleteFreelancer(deleteConfirmation.id);
      } else if (deleteConfirmation.type === 'admin') {
        await onDeleteAdmin(deleteConfirmation.id);
      } else if (deleteConfirmation.type === 'member') {
        await onDeleteMember(String(deleteConfirmation.id));
      } else if (deleteConfirmation.type === 'lead') {
        await onDeleteLead(deleteConfirmation.id);
      }
    } catch (err) {
      console.error('Error executing delete:', err);
    } finally {
      setDeletingConfirm(false);
      setDeleteConfirmation(null);
    }
  };

  // Clean WA for link
  const cleanWa = adminWa.replace(/[^0-9]/g, '') || '6285111029242';

  // Batasan format dan ukuran upload gambar (Audit Keamanan)
  const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
  const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

  // Handle image selection via input with strict validation and 5-photo maximum
  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);

    const currentTotal = existingImages.length + newImageFiles.length;
    if (currentTotal >= 5) {
      const msg = 'Maksimal 5 foto per talent. Hapus beberapa foto terlebih dahulu jika ingin menambah foto baru.';
      setUploadError(msg);
      onShowToast?.(msg, 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const validFiles: File[] = [];
    const errorMessages: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const lowerName = file.name.toLowerCase();
      const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
      const hasValidMime = ALLOWED_MIME_TYPES.includes(file.type.toLowerCase());

      // 1. Validasi Format Gambar: Hanya JPEG, PNG, WEBP
      if (!hasValidMime && !hasValidExt) {
        errorMessages.push(`Format file "${file.name}" tidak didukung. Hanya JPEG, PNG, atau WEBP yang diizinkan.`);
        continue;
      }

      // 2. Validasi Ukuran File: Maksimal 5MB
      if (file.size > MAX_FILE_SIZE_BYTES) {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
        errorMessages.push(`Ukuran file "${file.name}" (${sizeMb}MB) melebihi batas maksimal 5MB.`);
        continue;
      }

      validFiles.push(file);
    }

    const availableSlots = 5 - currentTotal;
    let filesToProcess = validFiles;
    if (validFiles.length > availableSlots) {
      errorMessages.push(`Maksimal 5 foto per talent. Hanya ${availableSlots} foto pertama yang ditambahkan.`);
      filesToProcess = validFiles.slice(0, availableSlots);
    }

    if (errorMessages.length > 0) {
      const combinedError = errorMessages.join(' ');
      setUploadError(combinedError);
      onShowToast?.(combinedError, 'error');
    }

    if (filesToProcess.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const readers: Promise<{ image: string; name: string }>[] = filesToProcess.map((file) => {
      return new Promise<{ image: string; name: string }>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({
            image: e.target?.result as string,
            name: file.name
          });
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readers).then((results) => {
      setNewImageFiles((prev) => [...prev, ...results]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    });
  };

  const handleEditFreelancer = (f: Freelancer) => {
    setEditingId(f.id);
    setName(f.name || '');
    setLocation(f.location || '');
    setStatus(f.status || 'Available');
    setService(f.service || '');
    setDescription(f.description || '');
    setUploadError(null);

    let imgs: string[] = [];
    if (Array.isArray(f.images)) {
      imgs = f.images;
    } else if (typeof f.images === 'string') {
      try {
        imgs = JSON.parse(f.images);
      } catch (e) {
        imgs = f.images ? [f.images] : [];
      }
    }
    setExistingImages(imgs);
    setNewImageFiles([]);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetFreelancerForm = () => {
    setEditingId(null);
    setName('');
    setLocation('');
    setStatus('Available');
    setService('');
    setDescription('');
    setExistingImages([]);
    setNewImageFiles([]);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmitFreelancer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSavingFreelancer(true);
    const ok = await onSaveFreelancer({
      id: editingId || undefined,
      name: name.trim(),
      location: location.trim() || '-',
      status: status || 'Available',
      service: service.trim() || '-',
      description: description.trim(),
      existingImages,
      newImageFiles
    });
    setSavingFreelancer(false);

    if (ok) {
      resetFreelancerForm();
    }
  };

  const handleCreateAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail.trim() || !adminPassword || !adminName.trim()) return;

    setCreatingAdmin(true);
    const ok = await onCreateAdmin({
      email: adminEmail.trim(),
      password: adminPassword,
      name: adminName.trim(),
      username: (adminUsername.trim() || adminEmail.split('@')[0]).trim()
    });
    setCreatingAdmin(false);

    if (ok) {
      setAdminEmail('');
      setAdminPassword('');
      setAdminName('');
      setAdminUsername('');
    }
  };

  const handleCreateMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberUsername.trim()) return;

    setCreatingMember(true);
    const ok = await onCreateMember(
      newMemberUsername.trim(),
      newMemberName.trim() || newMemberUsername.trim()
    );
    setCreatingMember(false);

    if (ok) {
      setNewMemberUsername('');
      setNewMemberName('');
    }
  };

  const handleRefreshLeadsClick = async () => {
    setRefreshingLeads(true);
    await onRefreshLeads();
    setRefreshingLeads(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10 animate-fadeIn">
      {/* Top Welcome & Stats Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-slate-950/15">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 font-bold text-xs border border-blue-400/20 mb-3">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Super Admin Workspace</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Dashboard Manajemen PROSS INDO
            </h1>
          </div>

          {/* Quick Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Total Talent
              </span>
              <span className="text-2xl sm:text-3xl font-black mt-1 block">
                {freelancers.length}
              </span>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Total Member
              </span>
              <span className="text-2xl sm:text-3xl font-black mt-1 block">
                {members.length}
              </span>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 col-span-2 sm:col-span-1">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Total Leads WA
              </span>
              <span className="text-2xl sm:text-3xl font-black mt-1 block text-emerald-400">
                {waLeads.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp Configuration Bar */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Phone className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm">
              Nomor WhatsApp Penerima Lead: <span className="font-mono text-emerald-700 font-black">+{cleanWa}</span>
            </h3>
            <p className="text-xs text-slate-500">
              Semua klik tombol WhatsApp pada katalog akan dialihkan ke nomor ini.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <a
            href={`https://wa.me/${cleanWa}?text=Tes%20Koneksi%20WhatsApp%20PROSS%20INDO`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Tes Nomor WA</span>
          </a>

          <button
            onClick={onOpenEditWaModal}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Ubah Nomor WA</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: KELOLA TALENTA FREELANCER (SUPABASE STORAGE) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Form Tambah / Edit Talent */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                {editingId ? <Edit3 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">
                  {editingId ? 'Edit Data Talent' : 'Tambah Talent Baru'}
                </h3>
                {editingId && (
                  <p className="text-[11px] text-slate-500">
                    Mengubah ID: {editingId}
                  </p>
                )}
              </div>
            </div>

            {editingId && (
              <button
                type="button"
                onClick={resetFreelancerForm}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Batal</span>
              </button>
            )}
          </div>

          <form onSubmit={handleSubmitFreelancer} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                NAMA TALENT *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder=""
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-xs sm:text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Lokasi / Kota
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder=""
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-xs sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Status Ketersediaan
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-xs sm:text-sm bg-white"
                >
                  <option value="Available">Available (Tersedia)</option>
                  <option value="Busy">Sold Out (Penuh)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                LAYANAN / KEAHLIAN
              </label>
              <input
                type="text"
                value={service}
                onChange={(e) => setService(e.target.value)}
                placeholder=""
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                DESKRIPSI PROFIL TALENT
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder=""
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-xs sm:text-sm resize-none"
              />
            </div>

            {/* Unggah Gambar ke Supabase Storage */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>FOTO TALENT (Max. 5 Foto)</span>
              </label>

              {/* Upload Drop Area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-colors ${
                  uploadError
                    ? 'border-red-300 bg-red-50/40 hover:bg-red-50/70'
                    : 'border-slate-200 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/30'
                }`}
              >
                <UploadCloud className={`w-7 h-7 mx-auto mb-1.5 ${uploadError ? 'text-red-500' : 'text-blue-500'}`} />
                <p className="text-xs font-bold text-slate-700">
                  Klik untuk pilih foto dari perangkat
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Format: JPEG, PNG, WEBP &bull; Maksimal 5MB per file
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => handleFilesSelected(e.target.files)}
                  className="hidden"
                />
              </div>

              {/* Notifikasi Error Validasi Gambar */}
              {uploadError && (
                <div className="mt-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2 animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                  <div className="flex-1 leading-relaxed">
                    <p className="font-bold">Gagal Mengunggah Foto</p>
                    <p className="text-[11px] text-red-600 mt-0.5">{uploadError}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUploadError(null)}
                    className="text-red-400 hover:text-red-600 p-0.5"
                    title="Tutup pesan"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Thumbnails of existing and newly selected photos */}
              {(existingImages.length > 0 || newImageFiles.length > 0) && (
                <div className="mt-3 flex flex-wrap gap-2.5">
                  {/* Existing Images */}
                  {existingImages.map((url, idx) => (
                    <div key={`exist-${idx}`} className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 group">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setExistingImages(existingImages.filter((_, i) => i !== idx))}
                        className="absolute inset-0 bg-red-950/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Hapus foto ini"
                      >
                        <Trash2 className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  ))}

                  {/* New Images */}
                  {newImageFiles.map((item, idx) => (
                    <div key={`new-${idx}`} className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-blue-500 group">
                      <img src={item.image} alt="" className="w-full h-full object-cover" />
                      <span className="absolute bottom-0 inset-x-0 bg-blue-600 text-white text-[8px] font-bold text-center py-0.5">
                        Baru
                      </span>
                      <button
                        type="button"
                        onClick={() => setNewImageFiles(newImageFiles.filter((_, i) => i !== idx))}
                        className="absolute inset-0 bg-red-950/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Hapus foto ini"
                      >
                        <Trash2 className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 flex gap-2">
              {editingId && (
                <button
                  type="button"
                  onClick={resetFreelancerForm}
                  className="py-3 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
              )}
              <button
                type="submit"
                disabled={savingFreelancer || !name.trim()}
                className="flex-1 py-3 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
              >
                {savingFreelancer ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan & Upload Gambar...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{editingId ? 'Simpan Pembaruan' : 'Tambah ke Katalog'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Tabel Daftar Talent */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
            <div>
              <h3 className="font-black text-slate-900 text-base">
                Daftar Talent ({freelancers.length})
              </h3>
              <p className="text-[11px] text-slate-500">
                Data Talent yang aktif ditampilkan pada Halaman Member
              </p>
            </div>
          </div>

          {freelancers.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-medium">
              Belum ada data talenta. Silakan isi form di samping untuk menambahkan.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="pb-3 pr-3">Foto & Nama</th>
                    <th className="pb-3 px-3">Layanan</th>
                    <th className="pb-3 px-3">Lokasi</th>
                    <th className="pb-3 px-3">Status</th>
                    <th className="pb-3 pl-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {freelancers.map((f) => {
                    let imgs: string[] = [];
                    if (Array.isArray(f.images)) {
                      imgs = f.images;
                    } else if (typeof f.images === 'string') {
                      try { imgs = JSON.parse(f.images); } catch(e) { imgs = [f.images]; }
                    }
                    const thumb = imgs[0] || 'https://placehold.co/80x80?text=Talent';

                    return (
                      <tr key={f.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-2.5">
                            <img src={thumb} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0 bg-slate-100" />
                            <span className="font-bold text-slate-900 truncate max-w-[130px]">{f.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-medium truncate max-w-[120px]">
                          {f.service}
                        </td>
                        <td className="py-3 px-3 text-slate-500 truncate max-w-[90px]">
                          {f.location}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            f.status === 'Available' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {f.status}
                          </span>
                        </td>
                        <td className="py-3 pl-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => handleEditFreelancer(f)}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Edit"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmation({ type: 'talent', id: f.id, name: f.name })}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Hapus"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: KELOLA AKUN SUPER ADMIN & MEMBER */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Kelola Akun Super Admin */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-3 pb-4 mb-5 border-b border-slate-100">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">
                Kelola Super Admin Supabase
              </h3>
            </div>
          </div>

          {/* Form Buat Admin Baru */}
          <form onSubmit={handleCreateAdminSubmit} className="space-y-3.5 mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
            <span className="text-xs font-extrabold text-slate-800 block">
              Tambah Akun Super Admin Baru
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="Email admin..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-blue-600"
              />
              <input
                type="password"
                required
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Password..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-blue-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                required
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="Nama Lengkap..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-blue-600"
              />
              <input
                type="text"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                placeholder="Username (opsional)..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-blue-600"
              />
            </div>

            <button
              type="submit"
              disabled={creatingAdmin || !adminEmail.trim() || !adminPassword || !adminName.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
            >
              {creatingAdmin ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              <span>Buat Akun Super Admin</span>
            </button>
          </form>

          {/* List Super Admin */}
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {admins.map((adm) => {
              const isMe = adm.email === currentUser.email || adm.username === currentUser.username;
              return (
                <div
                  key={adm.id || adm.email}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/60 text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 truncate">
                        {adm.name || adm.username || adm.email}
                      </span>
                      {isMe && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-blue-600 text-white">
                          Sesi Anda
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">{adm.email}</p>
                  </div>

                  {!isMe && (
                    <button
                      onClick={() => setDeleteConfirmation({ type: 'admin', id: adm.id || adm.email, name: adm.name || adm.username || adm.email || 'Admin' })}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Hapus Admin"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Kelola Akun Member */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-3 pb-4 mb-5 border-b border-slate-100">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">
                Kelola Member ({members.length})
              </h3>
            </div>
          </div>

          {/* Form Tambah Member */}
          <form onSubmit={handleCreateMemberSubmit} className="flex flex-col gap-2.5 mb-6">
            <input
              type="text"
              required
              value={newMemberUsername}
              onChange={(e) => setNewMemberUsername(e.target.value)}
              placeholder="Username member..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-emerald-600"
            />
            <input
              type="text"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              placeholder="Nama Member"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-emerald-600"
            />
            <button
              type="submit"
              disabled={creatingMember || !newMemberUsername.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
            >
              {creatingMember ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>Tambah Member</span>
            </button>
          </form>

          {/* List Member */}
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {members.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                Belum ada data member terdaftar.
              </div>
            ) : (
              members.map((m) => (
                <div
                  key={m.username}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/60 text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-900">{m.username}</span>
                    {m.name && m.name !== m.username && (
                      <span className="text-slate-500 text-[11px] ml-2">({m.name})</span>
                    )}
                  </div>
                  <button
                    onClick={() => setDeleteConfirmation({ type: 'member', id: m.username, name: m.name || m.username })}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Hapus Member"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* SECTION 3: RIWAYAT LEAD WHATSAPP */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">
                Riwayat Lead ({waLeads.length})
              </h3>
              <p className="text-[11px] text-slate-500">
                Log pengunjung & member yang telah menghubungi Admin WhatsApp via katalog
              </p>
            </div>
          </div>

          <button
            onClick={handleRefreshLeadsClick}
            disabled={refreshingLeads}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshingLeads ? 'animate-spin' : ''}`} />
            <span>Muat Ulang</span>
          </button>
        </div>

        {waLeads.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs font-medium">
            Belum ada data lead WhatsApp yang tercatat.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="pb-3 pr-3">Waktu</th>
                  <th className="pb-3 px-3">Nama Pengirim</th>
                  <th className="pb-3 px-3">Talenta Tujuan</th>
                  <th className="pb-3 px-3">Layanan</th>
                  <th className="pb-3 px-3">Catatan / Proyek</th>
                  <th className="pb-3 px-3">Status</th>
                  <th className="pb-3 pl-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {waLeads.map((lead) => (
                  <tr key={lead.id || `${lead.member_name}-${lead.talent_name}`} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 pr-3 text-slate-400 whitespace-nowrap">
                      {lead.created_at ? new Date(lead.created_at).toLocaleString('id-ID') : '-'}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                      {lead.member_name}
                    </td>
                    <td className="py-3 px-3 font-semibold text-blue-600 whitespace-nowrap">
                      {lead.talent_name}
                    </td>
                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                      {lead.service}
                    </td>
                    <td className="py-3 px-3 text-slate-500 max-w-xs truncate">
                      {lead.reference}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3 h-3" />
                        Terkirim ke WA
                      </span>
                    </td>
                    <td className="py-3 pl-3 text-right whitespace-nowrap">
                      {lead.id && (
                        <button
                          onClick={() => setDeleteConfirmation({ type: 'lead', id: lead.id!, name: `Lead "${lead.talent_name}" dari ${lead.member_name}` })}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                          title="Hapus Entri"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Konfirmasi Hapus Data (Aman, Iframe-friendly) */}
      {deleteConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div 
            className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Konfirmasi Hapus Data
                  </h3>
                  <p className="text-[11px] text-slate-500 capitalize">
                    {deleteConfirmation.type === 'talent' ? 'Hapus Talent dari Database' :
                     deleteConfirmation.type === 'admin' ? 'Hapus Akun Admin' :
                     deleteConfirmation.type === 'member' ? 'Hapus Akun Member' : 'Hapus Riwayat Lead'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => !deletingConfirm && setDeleteConfirmation(null)}
                disabled={deletingConfirm}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-5 text-xs sm:text-sm text-slate-600 leading-relaxed">
              <p>
                Apakah Anda yakin ingin menghapus <strong className="text-slate-900 font-black break-all">{deleteConfirmation.name}</strong> dari database Supabase?
              </p>
              {deleteConfirmation.type === 'talent' && (
                <p className="mt-2 text-[11px] text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-100">
                  Berkas foto terkait di Supabase Storage (bucket <em>freelancer-images</em>) juga akan dibersihkan secara otomatis.
                </p>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
              <button
                type="button"
                disabled={deletingConfirm}
                onClick={() => setDeleteConfirmation(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deletingConfirm}
                onClick={handleExecuteDelete}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-500/20 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
              >
                {deletingConfirm ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Ya, Hapus Data</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
