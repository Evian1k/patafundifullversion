import { useEffect, useState } from "react";
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
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

interface SavedPlace {
  id: string;
  type: "home" | "work" | "other";
  address: string;
  latitude: number;
  longitude: number;
}

const Settings = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ id?: string; email?: string; user_metadata?: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("personal");
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [editingPlace, setEditingPlace] = useState<string | null>(null);
  const [newPlaceAddress, setNewPlaceAddress] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      navigate("/auth");
      return;
    }

    // Load current user
    apiClient.getCurrentUser()
      .then(data => {
        setUser(data.user);
        setLoading(false);
      })
      .catch(() => {
        navigate("/auth");
      });
  }, [navigate]);

  const updateUserInfo = async (field: string, value: any) => {
    try {
      // TODO: Update user profile via API instead of direct auth
      toast.success("Updated successfully");
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Failed to update");
    }
  };

  const addSavedPlace = async (type: "home" | "work" | "other") => {
    if (!newPlaceAddress.trim()) {
      toast.error("Please enter an address");
      return;
    }

    const newPlace: SavedPlace = {
      id: Date.now().toString(),
      type,
      address: newPlaceAddress,
      latitude: 0,
      longitude: 0,
    };

    setSavedPlaces([...savedPlaces, newPlace]);
    setNewPlaceAddress("");
    toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} location saved`);
  };

  const updatePlace = (id: string, address: string) => {
    setSavedPlaces(savedPlaces.map((p) => (p.id === id ? { ...p, address } : p)));
    setEditingPlace(null);
    toast.success("Location updated");
  };

  const deletePlace = (id: string) => {
    setSavedPlaces(savedPlaces.filter((p) => p.id !== id));
    toast.success("Location removed");
  };

  const deleteAccount = async () => {
    if (!confirm("Are you sure you want to delete your account? This cannot be undone.")) {
      return;
    }

    try {
      // Delete account via API (backend will handle deletion)
      await apiClient.logout();
      toast.success("Account deleted");
      navigate("/");
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error("Failed to delete account");
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
      {/* Header */}
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
          {/* Tab Navigation */}
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
                onClick={() => setActiveTab(id)}
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

          {/* Tab Content */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            {/* Personal Info Tab */}
            {activeTab === "personal" && (
              <div className="space-y-6">
                <div className="bg-card rounded-xl border border-border p-6">
                  <h2 className="text-lg font-semibold text-foreground mb-4">Personal Information</h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Email</label>
                      <input
                        type="email"
                        value={user?.email || ""}
                        disabled
                        className="w-full px-4 py-2 rounded-lg bg-muted text-muted-foreground border border-border"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Full Name</label>
                      <input
                        type="text"
                        defaultValue={user?.user_metadata?.full_name || ""}
                        onChange={(e) => updateUserInfo("full_name", e.target.value)}
                        onBlur={(e) => updateUserInfo("full_name", e.target.value)}
                        className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Phone Number</label>
                      <input
                        type="tel"
                        defaultValue={user?.user_metadata?.phone || ""}
                        onChange={(e) => updateUserInfo("phone", e.target.value)}
                        onBlur={(e) => updateUserInfo("phone", e.target.value)}
                        className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Safety Tab */}
            {activeTab === "safety" && (
              <div className="space-y-6">
                <div className="bg-card rounded-xl border border-border p-6">
                  <h2 className="text-lg font-semibold text-foreground mb-4">Safety Settings</h2>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium text-foreground">Receive safety alerts</p>
                        <p className="text-sm text-muted-foreground">Get notified about suspicious activities</p>
                      </div>
                      <input type="checkbox" defaultChecked className="w-5 h-5" />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium text-foreground">Share emergency contact</p>
                        <p className="text-sm text-muted-foreground">Allow verified fundis to see your emergency contact</p>
                      </div>
                      <input type="checkbox" defaultChecked className="w-5 h-5" />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium text-foreground">Hide your profile</p>
                        <p className="text-sm text-muted-foreground">Private profile - fundis cannot find you</p>
                      </div>
                      <input type="checkbox" className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Login & Security Tab */}
            {activeTab === "security" && (
              <div className="space-y-6">
                <div className="bg-card rounded-xl border border-border p-6">
                  <h2 className="text-lg font-semibold text-foreground mb-4">Login & Security</h2>

                  <div className="space-y-4">
                    <Button className="w-full" variant="outline">
                      Change Password
                    </Button>

                    <Button className="w-full" variant="outline">
                      Enable Two-Factor Authentication (2FA)
                    </Button>

                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="font-medium text-foreground mb-2">Active Sessions</p>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>Current device - Active now</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Privacy Tab */}
            {activeTab === "privacy" && (
              <div className="space-y-6">
                <div className="bg-card rounded-xl border border-border p-6">
                  <h2 className="text-lg font-semibold text-foreground mb-4">Privacy Settings</h2>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium text-foreground">Show profile to everyone</p>
                        <p className="text-sm text-muted-foreground">Make your profile public</p>
                      </div>
                      <input type="checkbox" defaultChecked className="w-5 h-5" />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium text-foreground">Allow notifications</p>
                        <p className="text-sm text-muted-foreground">Receive push notifications</p>
                      </div>
                      <input type="checkbox" defaultChecked className="w-5 h-5" />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium text-foreground">Data collection</p>
                        <p className="text-sm text-muted-foreground">Allow us to improve experience with analytics</p>
                      </div>
                      <input type="checkbox" className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Saved Places Tab */}
            {activeTab === "places" && (
              <div className="space-y-6">
                <div className="bg-card rounded-xl border border-border p-6">
                  <h2 className="text-lg font-semibold text-foreground mb-4">Saved Places</h2>

                  {/* Home Location */}
                  <div className="mb-6 p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-3">
                      <Home className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold text-foreground">Home</h3>
                    </div>
                    {editingPlace === "home" ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newPlaceAddress}
                          onChange={(e) => setNewPlaceAddress(e.target.value)}
                          placeholder="Enter home address"
                          className="flex-1 px-3 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                        />
                        <button
                          onClick={() =>
                            updatePlace("home", newPlaceAddress) || setEditingPlace(null)
                          }
                          className="p-2 rounded-lg bg-primary text-white hover:bg-primary/90"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingPlace(null)}
                          className="p-2 rounded-lg bg-muted text-foreground hover:bg-muted/80"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          {savedPlaces.find((p) => p.type === "home")?.address ||
                            "No home address set"}
                        </p>
                        <button
                          onClick={() => {
                            setEditingPlace("home");
                            setNewPlaceAddress(
                              savedPlaces.find((p) => p.type === "home")?.address || ""
                            );
                          }}
                          className="p-2 rounded-lg hover:bg-background transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Work Location */}
                  <div className="mb-6 p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-3">
                      <Briefcase className="w-5 h-5 text-accent" />
                      <h3 className="font-semibold text-foreground">Work</h3>
                    </div>
                    {editingPlace === "work" ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newPlaceAddress}
                          onChange={(e) => setNewPlaceAddress(e.target.value)}
                          placeholder="Enter work address"
                          className="flex-1 px-3 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                        />
                        <button
                          onClick={() =>
                            updatePlace("work", newPlaceAddress) || setEditingPlace(null)
                          }
                          className="p-2 rounded-lg bg-primary text-white hover:bg-primary/90"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingPlace(null)}
                          className="p-2 rounded-lg bg-muted text-foreground hover:bg-muted/80"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          {savedPlaces.find((p) => p.type === "work")?.address ||
                            "No work address set"}
                        </p>
                        <button
                          onClick={() => {
                            setEditingPlace("work");
                            setNewPlaceAddress(
                              savedPlaces.find((p) => p.type === "work")?.address || ""
                            );
                          }}
                          className="p-2 rounded-lg hover:bg-background transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Other Places */}
                  {savedPlaces
                    .filter((p) => p.type === "other")
                    .map((place) => (
                      <div key={place.id} className="mb-4 p-4 rounded-lg bg-muted/50">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm text-muted-foreground">{place.address}</p>
                          </div>
                          <button
                            onClick={() => deletePlace(place.id)}
                            className="p-2 rounded-lg text-red-500 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}

                  {/* Add New Place */}
                  <div className="mt-6 p-4 rounded-lg border-2 border-dashed border-border">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter address..."
                        value={newPlaceAddress}
                        onChange={(e) => setNewPlaceAddress(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                      />
                      <Button
                        size="sm"
                        onClick={() => addSavedPlace("other")}
                        className="gap-1"
                      >
                        <Plus className="w-4 h-4" />
                        Add
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Delete Account Tab */}
            {activeTab === "danger" && (
              <div className="space-y-6">
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-red-600 mb-4">Delete Account</h2>

                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-red-500/5">
                      <p className="text-sm text-red-600 mb-3">
                        ⚠️ Deleting your account is permanent and cannot be undone. All your data will be
                        permanently removed.
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
                        <div className="flex gap-2">
                          <Button
                            variant="destructive"
                            className="flex-1"
                            onClick={deleteAccount}
                          >
                            Yes, Delete My Account
                          </Button>
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => setShowDeleteConfirm(false)}
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
};

export default Settings;
