import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  User,
  Shield,
  Lock,
  Eye,
  MapPin,
  Trash2,
  Plus,
  Home,
  Briefcase,
  Edit2,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

interface SavedPlace {
  id: string;
  type: "home" | "work" | "other";
  label?: string | null;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface MeUser {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: string;
}

interface SettingsRow {
  safety_alerts?: boolean;
  share_emergency_contact?: boolean;
  hide_profile?: boolean;
  privacy_marketing_opt_in?: boolean;
  privacy_share_location?: boolean;
}

export default function Settings() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "personal" | "safety" | "security" | "privacy" | "places" | "danger"
  >("personal");

  const [user, setUser] = useState<MeUser | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [settings, setSettings] = useState({
    safetyAlerts: true,
    shareEmergencyContact: false,
    hideProfile: false,
    marketingOptIn: true,
    shareLocation: true,
  });
  const [savingSettingsKey, setSavingSettingsKey] = useState<string | null>(null);

  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [editingPlace, setEditingPlace] = useState<"home" | "work" | null>(null);
  const [placeDraft, setPlaceDraft] = useState("");
  const [newOtherPlace, setNewOtherPlace] = useState("");

  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwNew2, setPwNew2] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const homePlace = useMemo(
    () => savedPlaces.find((p) => p.type === "home") || null,
    [savedPlaces],
  );
  const workPlace = useMemo(
    () => savedPlaces.find((p) => p.type === "work") || null,
    [savedPlaces],
  );
  const otherPlaces = useMemo(
    () => savedPlaces.filter((p) => p.type === "other"),
    [savedPlaces],
  );

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      navigate("/auth");
      return;
    }

    (async () => {
      try {
        const [meRes, settingsRes, placesRes] = await Promise.all([
          apiClient.getCurrentUser(),
          apiClient.getUserSettings(),
          apiClient.getSavedPlaces(),
        ]);

        const me = (meRes?.user || null) as MeUser | null;
        setUser(me);
        setFullName(me?.fullName || "");
        setPhone(me?.phone || "");

        const row = (settingsRes?.settings || {}) as SettingsRow;
        setSettings({
          safetyAlerts: row.safety_alerts ?? true,
          shareEmergencyContact: row.share_emergency_contact ?? false,
          hideProfile: row.hide_profile ?? false,
          marketingOptIn: row.privacy_marketing_opt_in ?? true,
          shareLocation: row.privacy_share_location ?? true,
        });

        setSavedPlaces((placesRes?.places || []) as SavedPlace[]);
      } catch (e) {
        navigate("/auth");
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const savePersonalInfo = async () => {
    try {
      setSavingProfile(true);
      await apiClient.updateMe({
        fullName: fullName.trim() || null,
        phone: phone.trim() || null,
      });
      // refresh /me so UI stays aligned with server
      const meRes = await apiClient.getCurrentUser();
      setUser(meRes?.user || null);
      toast.success("Personal info updated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to update");
    } finally {
      setSavingProfile(false);
    }
  };

  const updateSetting = async (key: keyof typeof settings, value: boolean) => {
    setSettings((s) => ({ ...s, [key]: value }));
    setSavingSettingsKey(String(key));
    try {
      await apiClient.updateUserSettings({ [key]: value });
    } catch (e: any) {
      toast.error(e?.message || "Failed to update setting");
      try {
        const fresh = await apiClient.getUserSettings();
        const row = (fresh?.settings || {}) as SettingsRow;
        setSettings({
          safetyAlerts: row.safety_alerts ?? true,
          shareEmergencyContact: row.share_emergency_contact ?? false,
          hideProfile: row.hide_profile ?? false,
          marketingOptIn: row.privacy_marketing_opt_in ?? true,
          shareLocation: row.privacy_share_location ?? true,
        });
      } catch {
        // ignore
      }
    } finally {
      setSavingSettingsKey(null);
    }
  };

  const startEditPlace = (type: "home" | "work") => {
    setEditingPlace(type);
    setPlaceDraft(type === "home" ? homePlace?.address || "" : workPlace?.address || "");
  };

  const upsertSavedPlace = async (type: "home" | "work", address: string) => {
    const trimmed = address.trim();
    if (!trimmed) {
      toast.error("Please enter an address");
      return;
    }

    try {
      const existing = savedPlaces.find((p) => p.type === type);
      if (existing) {
        const res = await apiClient.updateSavedPlace(existing.id, { address: trimmed });
        const updated = (res?.place || null) as SavedPlace | null;
        if (updated) setSavedPlaces((prev) => prev.map((p) => (p.id === existing.id ? updated : p)));
      } else {
        const res = await apiClient.addSavedPlace({ type, address: trimmed });
        const created = (res?.place || null) as SavedPlace | null;
        if (created) setSavedPlaces((prev) => [created, ...prev]);
      }
      toast.success(`${type === "home" ? "Home" : "Work"} location saved`);
      setEditingPlace(null);
      setPlaceDraft("");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save place");
    }
  };

  const addOtherPlace = async () => {
    const trimmed = newOtherPlace.trim();
    if (!trimmed) {
      toast.error("Please enter an address");
      return;
    }
    try {
      const res = await apiClient.addSavedPlace({ type: "other", address: trimmed });
      const created = (res?.place || null) as SavedPlace | null;
      if (created) setSavedPlaces((prev) => [created, ...prev]);
      setNewOtherPlace("");
      toast.success("Place saved");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save place");
    }
  };

  const deleteOtherPlace = async (id: string) => {
    try {
      await apiClient.deleteSavedPlace(id);
      setSavedPlaces((prev) => prev.filter((p) => p.id !== id));
      toast.success("Location removed");
    } catch (e: any) {
      toast.error(e?.message || "Failed to remove location");
    }
  };

  const handleChangePassword = async () => {
    if (!pwCurrent || !pwNew) {
      toast.error("Enter current and new password");
      return;
    }
    if (pwNew.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (pwNew !== pwNew2) {
      toast.error("New passwords do not match");
      return;
    }
    try {
      setChangingPw(true);
      await apiClient.changePassword(pwCurrent, pwNew);
      setPwCurrent("");
      setPwNew("");
      setPwNew2("");
      toast.success("Password changed");
    } catch (e: any) {
      toast.error(e?.message || "Failed to change password");
    } finally {
      setChangingPw(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      toast.error("Enter your password to delete your account");
      return;
    }
    try {
      setDeleting(true);
      await apiClient.deleteAccount(deletePassword);
      await apiClient.logout();
      toast.success("Account deleted");
      navigate("/");
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete account");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>

          <span className="text-lg font-display font-bold text-foreground">Settings</span>
          <div className="w-24" />
        </div>
      </header>

      <main className="pt-24 pb-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex gap-2 mb-8 overflow-x-auto pb-2 border-b border-border">
            {[
              { id: "personal", label: "Personal Info", icon: User },
              { id: "safety", label: "Safety", icon: Shield },
              { id: "security", label: "Login & Security", icon: Lock },
              { id: "privacy", label: "Privacy", icon: Eye },
              { id: "places", label: "Saved Places", icon: MapPin },
              { id: "danger", label: "Delete Account", icon: Trash2 },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all whitespace-nowrap ${
                  activeTab === id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "personal" && (
              <div className="space-y-6">
                <div className="bg-card rounded-xl border border-border p-6">
                  <h2 className="text-lg font-semibold text-foreground mb-4">
                    Personal Information
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        value={user?.email || ""}
                        disabled
                        className="w-full px-4 py-2 rounded-lg bg-muted text-muted-foreground border border-border"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Email cannot be changed
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>

                    <div className="pt-2">
                      <Button
                        onClick={savePersonalInfo}
                        disabled={savingProfile}
                        className="w-full gap-2"
                      >
                        {savingProfile && <Loader2 className="w-4 h-4 animate-spin" />}
                        Save Changes
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "safety" && (
              <div className="space-y-6">
                <div className="bg-card rounded-xl border border-border p-6">
                  <h2 className="text-lg font-semibold text-foreground mb-4">
                    Safety Settings
                  </h2>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium text-foreground">Receive safety alerts</p>
                        <p className="text-sm text-muted-foreground">
                          Get notified about suspicious activities
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.safetyAlerts}
                        onChange={(e) => updateSetting("safetyAlerts", e.target.checked)}
                        className="w-5 h-5"
                        disabled={savingSettingsKey === "safetyAlerts"}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium text-foreground">Share emergency contact</p>
                        <p className="text-sm text-muted-foreground">
                          Allow verified fundis to see your emergency contact
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.shareEmergencyContact}
                        onChange={(e) =>
                          updateSetting("shareEmergencyContact", e.target.checked)
                        }
                        className="w-5 h-5"
                        disabled={savingSettingsKey === "shareEmergencyContact"}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium text-foreground">Hide your profile</p>
                        <p className="text-sm text-muted-foreground">
                          Private profile, fundis cannot discover you
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.hideProfile}
                        onChange={(e) => updateSetting("hideProfile", e.target.checked)}
                        className="w-5 h-5"
                        disabled={savingSettingsKey === "hideProfile"}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "security" && (
              <div className="space-y-6">
                <div className="bg-card rounded-xl border border-border p-6">
                  <h2 className="text-lg font-semibold text-foreground mb-4">
                    Login & Security
                  </h2>

                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="font-medium text-foreground mb-3">Change Password</p>
                      <div className="space-y-3">
                        <input
                          type="password"
                          value={pwCurrent}
                          onChange={(e) => setPwCurrent(e.target.value)}
                          placeholder="Current password"
                          className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                        <input
                          type="password"
                          value={pwNew}
                          onChange={(e) => setPwNew(e.target.value)}
                          placeholder="New password (min 8 chars)"
                          className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                        <input
                          type="password"
                          value={pwNew2}
                          onChange={(e) => setPwNew2(e.target.value)}
                          placeholder="Confirm new password"
                          className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                        <Button
                          onClick={handleChangePassword}
                          disabled={changingPw}
                          className="w-full gap-2"
                        >
                          {changingPw && <Loader2 className="w-4 h-4 animate-spin" />}
                          Update Password
                        </Button>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="font-medium text-foreground mb-2">Active Sessions</p>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>Current device, active now</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "privacy" && (
              <div className="space-y-6">
                <div className="bg-card rounded-xl border border-border p-6">
                  <h2 className="text-lg font-semibold text-foreground mb-4">
                    Privacy Settings
                  </h2>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium text-foreground">Marketing emails</p>
                        <p className="text-sm text-muted-foreground">
                          Allow product updates and offers
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.marketingOptIn}
                        onChange={(e) => updateSetting("marketingOptIn", e.target.checked)}
                        className="w-5 h-5"
                        disabled={savingSettingsKey === "marketingOptIn"}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium text-foreground">Share location with fundis</p>
                        <p className="text-sm text-muted-foreground">
                          Helps matching and ETA during active jobs
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.shareLocation}
                        onChange={(e) => updateSetting("shareLocation", e.target.checked)}
                        className="w-5 h-5"
                        disabled={savingSettingsKey === "shareLocation"}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "places" && (
              <div className="space-y-6">
                <div className="bg-card rounded-xl border border-border p-6">
                  <h2 className="text-lg font-semibold text-foreground mb-4">Saved Places</h2>

                  <div className="mb-6 p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-3">
                      <Home className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold text-foreground">Home</h3>
                    </div>
                    {editingPlace === "home" ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={placeDraft}
                          onChange={(e) => setPlaceDraft(e.target.value)}
                          placeholder="Enter home address"
                          className="flex-1 px-3 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                        />
                        <button
                          onClick={() => upsertSavedPlace("home", placeDraft)}
                          className="p-2 rounded-lg bg-primary text-white hover:bg-primary/90"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingPlace(null);
                            setPlaceDraft("");
                          }}
                          className="p-2 rounded-lg bg-muted text-foreground hover:bg-muted/80"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          {homePlace?.address || "No home address set"}
                        </p>
                        <button
                          onClick={() => startEditPlace("home")}
                          className="p-2 rounded-lg hover:bg-background transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mb-6 p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-3">
                      <Briefcase className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold text-foreground">Work</h3>
                    </div>
                    {editingPlace === "work" ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={placeDraft}
                          onChange={(e) => setPlaceDraft(e.target.value)}
                          placeholder="Enter work address"
                          className="flex-1 px-3 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                        />
                        <button
                          onClick={() => upsertSavedPlace("work", placeDraft)}
                          className="p-2 rounded-lg bg-primary text-white hover:bg-primary/90"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingPlace(null);
                            setPlaceDraft("");
                          }}
                          className="p-2 rounded-lg bg-muted text-foreground hover:bg-muted/80"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          {workPlace?.address || "No work address set"}
                        </p>
                        <button
                          onClick={() => startEditPlace("work")}
                          className="p-2 rounded-lg hover:bg-background transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {otherPlaces.map((place) => (
                    <div key={place.id} className="mb-4 p-4 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm text-muted-foreground">{place.address}</p>
                        </div>
                        <button
                          onClick={() => deleteOtherPlace(place.id)}
                          className="p-2 rounded-lg text-red-500 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="mt-6 p-4 rounded-lg border-2 border-dashed border-border">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter address..."
                        value={newOtherPlace}
                        onChange={(e) => setNewOtherPlace(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                      />
                      <Button size="sm" onClick={addOtherPlace} className="gap-1">
                        <Plus className="w-4 h-4" />
                        Add
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "danger" && (
              <div className="space-y-6">
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-red-600 mb-4">Delete Account</h2>

                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-red-500/5">
                      <p className="text-sm text-red-600 mb-3">
                        Deleting your account is permanent and cannot be undone. All your data will be permanently
                        removed.
                      </p>
                    </div>

                    {!showDeleteConfirm ? (
                      <Button
                        variant="destructive"
                        className="w-full"
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        Delete My Account
                      </Button>
                    ) : (
                      <div className="space-y-3 p-4 rounded-lg bg-red-500/5 border border-red-500/20">
                        <p className="text-sm font-medium text-red-600">
                          Are you absolutely sure? This action cannot be undone.
                        </p>
                        <input
                          type="password"
                          value={deletePassword}
                          onChange={(e) => setDeletePassword(e.target.value)}
                          placeholder="Enter your password to confirm"
                          className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-red-500/40"
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="destructive"
                            className="flex-1 gap-2"
                            onClick={handleDeleteAccount}
                            disabled={deleting}
                          >
                            {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                            {deleting ? "Deleting..." : "Yes, Delete My Account"}
                          </Button>
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                              setShowDeleteConfirm(false);
                              setDeletePassword("");
                            }}
                            disabled={deleting}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}

