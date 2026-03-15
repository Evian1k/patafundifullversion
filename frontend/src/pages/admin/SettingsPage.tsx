import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Settings, Save, Loader2, Bell, Shield, Eye } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import AdminLayout from "@/components/admin/AdminLayout";

interface AdminSettings {
  platformCommissionRate: number;
  minimumJobPrice: number;
  maximumJobPrice: number;
  maintenanceMode: boolean;
  newRegistrationsEnabled: boolean;
  emailNotificationsEnabled: boolean;
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<AdminSettings>({
    platformCommissionRate: 10,
    minimumJobPrice: 100,
    maximumJobPrice: 50000,
    maintenanceMode: false,
    newRegistrationsEnabled: true,
    emailNotificationsEnabled: true,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await apiClient.request("/admin/settings", {
        includeAuth: true,
      });
      setSettings(response.settings || settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      // Use default settings if fetch fails
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await apiClient.request("/admin/settings", {
        method: "PUT",
        includeAuth: true,
        body: settings,
      });
      toast.success("Settings saved successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSettingChange = (key: keyof AdminSettings, value: any) => {
    setSettings({
      ...settings,
      [key]: value,
    });
  };

  return (
    <AdminLayout>
      <div className="p-8 space-y-6 max-w-4xl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Admin Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure platform settings and preferences
          </p>
        </div>

        {loading ? (
          <Card className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading settings...</p>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Financial Settings */}
            <motion.div whileHover={{ y: -2 }}>
              <Card className="p-6 border-2 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <Eye className="w-5 h-5 text-green-600" />
                  </div>
                  <h2 className="text-xl font-semibold">Financial Settings</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Platform Commission Rate (%)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={settings.platformCommissionRate}
                      onChange={(e) =>
                        handleSettingChange(
                          "platformCommissionRate",
                          parseFloat(e.target.value)
                        )
                      }
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Commission taken from each job payment
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Minimum Job Price (KES)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      value={settings.minimumJobPrice}
                      onChange={(e) =>
                        handleSettingChange(
                          "minimumJobPrice",
                          parseInt(e.target.value)
                        )
                      }
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Minimum price allowed for jobs
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Maximum Job Price (KES)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      value={settings.maximumJobPrice}
                      onChange={(e) =>
                        handleSettingChange(
                          "maximumJobPrice",
                          parseInt(e.target.value)
                        )
                      }
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Maximum price allowed for jobs
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Platform Settings */}
            <motion.div whileHover={{ y: -2 }}>
              <Card className="p-6 border-2 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Shield className="w-5 h-5 text-blue-600" />
                  </div>
                  <h2 className="text-xl font-semibold">Platform Settings</h2>
                </div>

                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer p-4 border rounded-lg hover:bg-gray-50 transition">
                    <input
                      type="checkbox"
                      checked={settings.maintenanceMode}
                      onChange={(e) =>
                        handleSettingChange("maintenanceMode", e.target.checked)
                      }
                      className="w-4 h-4 rounded"
                    />
                    <div>
                      <p className="font-medium text-gray-900">
                        Maintenance Mode
                      </p>
                      <p className="text-sm text-gray-600">
                        Disable platform access for users during maintenance
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer p-4 border rounded-lg hover:bg-gray-50 transition">
                    <input
                      type="checkbox"
                      checked={settings.newRegistrationsEnabled}
                      onChange={(e) =>
                        handleSettingChange(
                          "newRegistrationsEnabled",
                          e.target.checked
                        )
                      }
                      className="w-4 h-4 rounded"
                    />
                    <div>
                      <p className="font-medium text-gray-900">
                        Allow New Registrations
                      </p>
                      <p className="text-sm text-gray-600">
                        Allow customers and fundis to register new accounts
                      </p>
                    </div>
                  </label>
                </div>
              </Card>
            </motion.div>

            {/* Notification Settings */}
            <motion.div whileHover={{ y: -2 }}>
              <Card className="p-6 border-2 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Bell className="w-5 h-5 text-purple-600" />
                  </div>
                  <h2 className="text-xl font-semibold">Notifications</h2>
                </div>

                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer p-4 border rounded-lg hover:bg-gray-50 transition">
                    <input
                      type="checkbox"
                      checked={settings.emailNotificationsEnabled}
                      onChange={(e) =>
                        handleSettingChange(
                          "emailNotificationsEnabled",
                          e.target.checked
                        )
                      }
                      className="w-4 h-4 rounded"
                    />
                    <div>
                      <p className="font-medium text-gray-900">
                        Email Notifications
                      </p>
                      <p className="text-sm text-gray-600">
                        Send email notifications for important events
                      </p>
                    </div>
                  </label>
                </div>
              </Card>
            </motion.div>

            {/* Save Button */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSaveSettings}
                disabled={saving}
                className="flex-1"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Settings
                  </>
                )}
              </Button>
              <Button
                onClick={() => fetchSettings()}
                variant="outline"
                disabled={saving || loading}
              >
                Reset
              </Button>
            </div>

            {/* Danger Zone */}
            <Card className="p-6 border-2 border-red-200 bg-red-50">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-red-500/10 rounded-lg flex-shrink-0">
                  <Shield className="w-5 h-5 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-red-900 mb-2">Danger Zone</h3>
                  <p className="text-sm text-red-700 mb-4">
                    These actions are irreversible. Use with caution.
                  </p>
                  <Button
                    variant="outline"
                    className="text-red-600 hover:text-red-700 border-red-300 hover:bg-red-50"
                  >
                    Clear All Cache
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
