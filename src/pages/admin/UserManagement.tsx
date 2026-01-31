import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search, AlertCircle, Loader2, Ban, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface User {
  id: string;
  user_id: string;
  skills: string[];
  experience_years: number;
  verification_status: string;
  created_at: string;
  is_available: boolean;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    const filtered = users.filter(
      (user) =>
        user.user_id.includes(searchTerm) ||
        user.skills.some((s) => s.toLowerCase().includes(searchTerm.toLowerCase())) ||
        user.verification_status.includes(searchTerm)
    );
    setFilteredUsers(filtered);
  }, [searchTerm, users]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("fundi_profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleBanUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("fundi_profiles")
        .update({ is_available: false })
        .eq("id", userId);

      if (error) throw error;
      toast.success("User banned");
      fetchUsers();
      setSelectedUser(null);
    } catch (error) {
      toast.error("Failed to ban user");
    }
  };

  const handleReactivate = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("fundi_profiles")
        .update({ is_available: true })
        .eq("id", userId);

      if (error) throw error;
      toast.success("User reactivated");
      fetchUsers();
      setSelectedUser(null);
    } catch (error) {
      toast.error("Failed to reactivate user");
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">User Management</h1>
        <p className="text-muted-foreground">Manage fundis and their access</p>
      </div>

      {/* Search */}
      <Card className="p-4 border-2">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by user ID, skills, or verification status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Users List */}
        <div className="lg:col-span-2 space-y-3 max-h-[calc(100vh-300px)] overflow-auto">
          {filteredUsers.length === 0 ? (
            <Card className="p-8 text-center border-2">
              <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No users found</p>
            </Card>
          ) : (
            filteredUsers.map((user) => (
              <motion.div
                key={user.id}
                whileHover={{ x: 4 }}
                onClick={() => setSelectedUser(user)}
              >
                <Card
                  className={`p-4 border-2 cursor-pointer transition ${
                    selectedUser?.id === user.id
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/40"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <code className="text-sm font-mono text-primary">
                        {user.user_id.slice(0, 12)}...
                      </code>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          user.is_available
                            ? "bg-green-500/10 text-green-500"
                            : "bg-red-500/10 text-red-500"
                        }`}
                      >
                        {user.is_available ? "Active" : "Banned"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {user.skills.join(", ")} • {user.experience_years} years
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </div>

        {/* Detail Panel */}
        {selectedUser && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <Card className="p-6 border-2 space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">User Details</h3>
                <code className="text-sm font-mono text-primary">{selectedUser.user_id}</code>
              </div>

              <div>
                <p className="text-sm font-semibold mb-2">Skills</p>
                <div className="flex flex-wrap gap-2">
                  {selectedUser.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-lg"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-1 text-sm">
                <p>Experience: <span className="font-semibold">{selectedUser.experience_years} years</span></p>
                <p>Status: <span className="font-semibold">{selectedUser.verification_status}</span></p>
                <p className="text-xs text-muted-foreground">
                  Joined: {new Date(selectedUser.created_at).toLocaleString()}
                </p>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-border space-y-2">
                {selectedUser.is_available ? (
                  <Button
                    onClick={() => handleBanUser(selectedUser.id)}
                    variant="destructive"
                    className="w-full"
                  >
                    <Ban className="w-4 h-4 mr-2" />
                    Ban User
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleReactivate(selectedUser.id)}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reactivate
                  </Button>
                )}
              </div>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
