import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Edit2, Lock, Shield, CheckCircle, AlertTriangle, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { api } from '../lib/api';

interface UserItem {
  usuario: string;
  activo: string;
  rol: string;
}

interface UserManagementProps {
  session: string;
  adminPass: string;
  onAdminPassVerified: (pass: string) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({
  session,
  adminPass,
  onAdminPassVerified,
  showToast
}) => {
  const [isUnlocked, setIsUnlocked] = useState(!!adminPass);
  const [inputPass, setInputPass] = useState(adminPass || "");
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  // New user form state
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("USUARIO");  const [isCreating, setIsCreating] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPass.trim()) {
      setErrorMsg("Por favor ingrese la contraseña de Administrador.");
      return;
    }
    setIsLoading(true);
    setErrorMsg("");
    try {
      await api.verifyAdminPass(session, inputPass.trim());
      onAdminPassVerified(inputPass.trim());
      setIsUnlocked(true);
      showToast("Contraseña de Administrador verificada con éxito.", "success");
      fetchUsers(inputPass.trim());
    } catch (err: any) {
      setErrorMsg(err?.message || "Contraseña de Administrador incorrecta.");
      showToast("Contraseña incorrecta.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async (passToUse = adminPass) => {
    if (!passToUse) return;
    setIsLoading(true);
    try {
      const res = await api.listUsers(passToUse, session);
      if (res && Array.isArray((res as any).users)) {
        // El rol DESARROLLADOR (MAGXOR) no figura como credencial gestionable
        setUsers((res as any).users.filter((u: UserItem) => String(u.rol || "").toUpperCase() !== "DESARROLLADOR" && String(u.usuario || "").toLowerCase() !== "magxor"));
      }
    } catch (err: any) {
      console.error("Error fetching users:", err);
      showToast(err?.message || "Error al cargar la lista de usuarios.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (adminPass) {
      setIsUnlocked(true);
      fetchUsers(adminPass);
    }
  }, [adminPass]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword) {
      showToast("Complete usuario y contraseña.", "error");
      return;
    }
    setIsLoading(true);
    try {
      await api.admin(session, "createUser", {
        adminPass,
        usuario: newUsername.trim(),
        password: newPassword,
        rol: newRole
      });
      showToast(`Usuario "${newUsername}" creado con éxito.`, "success");
      setNewUsername("");
      setNewPassword("");
      fetchUsers();
    } catch (err: any) {
      showToast(err?.message || "Error al crear usuario.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (!confirm(`¿Está seguro de eliminar al usuario "${username}"?`)) return;
    setIsLoading(true);
    try {
      await api.admin(session, "deleteUser", {
        adminPass,
        usuario: username
      });
      showToast(`Usuario "${username}" eliminado.`, "success");
      fetchUsers();
    } catch (err: any) {
      showToast(err?.message || "Error al eliminar usuario.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async (user: UserItem) => {
    const nextActivo = user.activo.toUpperCase() === "SI" ? false : true;
    setIsLoading(true);
    try {
      await api.admin(session, "updateUser", {
        adminPass,
        usuario: user.usuario,
        activo: nextActivo,
        rol: user.rol
      });
      showToast(`Estado de "${user.usuario}" actualizado.`, "success");
      fetchUsers();
    } catch (err: any) {
      showToast(err?.message || "Error al actualizar estado del usuario.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleRole = async (user: UserItem) => {
    const r = user.rol.toUpperCase();
    const isAdminLike = r === "ADMIN" || r === "ADMINISTRADOR";
    const nextRol = isAdminLike ? "USUARIO" : "ADMINISTRADOR";
    setIsLoading(true);
    try {
      await api.admin(session, "updateUser", {
        adminPass,
        usuario: user.usuario,
        activo: user.activo.toUpperCase() === "SI",
        rol: nextRol
      });
      showToast(`Rol de "${user.usuario}" cambiado a ${nextRol}.`, "success");
      fetchUsers();
    } catch (err: any) {
      showToast(err?.message || "Error al cambiar rol.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isUnlocked) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            <span>Gestión de Usuarios</span>
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Sección protegida. Ingrese la contraseña de Administrador para gestionar usuarios.
          </p>
        </div>

        <div className="bg-[#151515] border border-white/10 rounded-3xl p-6 max-w-lg mx-auto shadow-xl">
          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="flex items-center gap-3 p-3.5 bg-blue-600/10 border border-blue-500/20 rounded-2xl text-blue-400 text-xs">
              <Lock className="w-5 h-5 shrink-0" />
              <span>Esta sección requiere autenticación con Admin Pass.</span>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Contraseña de Administrador (Admin Pass)
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={inputPass}
                onChange={(e) => setInputPass(e.target.value)}
                className="w-full text-xs bg-neutral-950 text-white rounded-xl border border-white/10 px-4 py-3 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/20 text-red-400 text-xs flex gap-2 items-center">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Desbloquear Gestión de Usuarios"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            <span>Gestión de Usuarios y Credenciales</span>
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Creación, asignación de roles, pausa y eliminación de cuentas de asociado.
          </p>
        </div>
        <button
          onClick={() => fetchUsers()}
          className="px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors cursor-pointer self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Actualizar Lista</span>
        </button>
      </div>

      {/* Create User Box */}
      <div className="bg-[#151515] border border-white/10 rounded-3xl p-5 md:p-6 shadow-lg space-y-4">
        <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
          <Plus className="w-4 h-4 text-blue-400" />
          <span>Crear Nuevo Usuario</span>
        </h4>
        <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Usuario (mín 3 car.)
            </label>
            <input
              type="text"
              required
              placeholder="Ej: vendedor2"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="w-full text-xs bg-neutral-950 text-white rounded-xl border border-white/10 px-3.5 py-2.5 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Contraseña (mín 6 car.)
            </label>
            <div className="relative">
              <input
                type={showNewPass ? "text" : "password"}
                required
                placeholder="••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full text-xs bg-neutral-950 text-white rounded-xl border border-white/10 px-3.5 pr-9 py-2.5 focus:border-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowNewPass(!showNewPass)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
              >
                {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Rol
            </label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="w-full text-xs bg-neutral-950 text-white rounded-xl border border-white/10 px-3.5 py-2.5 focus:border-blue-500 focus:outline-none cursor-pointer"
            >
              <option value="USUARIO">USUARIO (solo ver pedidos y clientes)</option>
              <option value="ADMINISTRADOR">ADMINISTRADOR (control total, sin código)</option>
            </select>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Cuenta</span>
            </button>
          </div>
        </form>
      </div>

      {/* Users Table / List */}
      <div className="bg-[#151515] border border-white/10 rounded-3xl overflow-hidden shadow-lg">
        <div className="p-4.5 border-b border-white/5 flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider">Usuarios Registrados ({users.length})</span>
        </div>

        {users.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            {isLoading ? "Cargando usuarios..." : "No se encontraron usuarios registrados."}
          </div>
        ) : (
          <div className="divide-y divide-white/5 overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#111111] text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="p-4">Usuario</th>
                  <th className="p-4">Rol</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((u, idx) => {
                  const isActive = u.activo.toUpperCase() === "SI";
                  const r = u.rol.toUpperCase();
                  const isAdmin = r === "ADMIN" || r === "ADMINISTRADOR";
                  return (
                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 font-bold text-white flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center font-black text-xs uppercase">
                          {u.usuario.charAt(0)}
                        </div>
                        <span>{u.usuario}</span>
                      </td>
                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() => handleToggleRole(u)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider cursor-pointer transition-colors ${
                            isAdmin ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                          }`}
                        >
                          <Shield className="w-3 h-3" />
                          <span>{isAdmin ? "ADMINISTRADOR" : u.rol}</span>
                        </button>
                      </td>
                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(u)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider cursor-pointer transition-colors ${
                            isActive ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'
                          }`}
                        >
                          {isActive ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                          <span>{isActive ? "Activo" : "Pausado"}</span>
                        </button>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u.usuario)}
                          className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1"
                          title="Eliminar usuario"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
  );
};
