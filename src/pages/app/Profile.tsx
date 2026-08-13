import { useEffect, useState } from "react";
import { Building2, Loader2, Save, User } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/auth-context";
import { useClientProfile, useUpdateClientProfile } from "@/hooks/useClients";
import { authService } from "@/services/auth.service";

const Profile = () => {
  const { user } = useAuth();
  const { data: clientProfile, isLoading: isLoadingClient } = useClientProfile();
  const updateClientProfile = useUpdateClientProfile();
  const [clientFormData, setClientFormData] = useState({
    name: "",
    email: "",
    phone: "",
    organisationName: "",
    registrationNumber: "",
    address: "",
  });
  const [clientInitialFormData, setClientInitialFormData] = useState(clientFormData);

  useEffect(() => {
    if (clientProfile) {
      const next = {
        name: user?.name || "",
        email: clientProfile.email || "",
        phone: clientProfile.phone || "",
        organisationName: clientProfile.organisationName || "",
        registrationNumber: clientProfile.registrationNumber || "",
        address: clientProfile.address || "",
      };
      setClientFormData(next);
      setClientInitialFormData(next);
    } else if (user) {
      const next = {
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        organisationName: user.organisationName || "",
        registrationNumber: "",
        address: "",
      };
      setClientFormData(next);
      setClientInitialFormData(next);
    }
  }, [clientProfile, user]);

  const hasClientProfileChanges =
    clientFormData.name !== clientInitialFormData.name ||
    clientFormData.email !== clientInitialFormData.email ||
    clientFormData.phone !== clientInitialFormData.phone ||
    clientFormData.organisationName !== clientInitialFormData.organisationName ||
    clientFormData.registrationNumber !== clientInitialFormData.registrationNumber ||
    clientFormData.address !== clientInitialFormData.address;

  const handleSave = () => {
    if (!clientFormData.name.trim() || !clientFormData.email.trim() || !clientFormData.phone.trim()) {
      toast.error("Contact name, email and phone number are required");
      return;
    }
    if (!clientFormData.organisationName.trim() || !clientFormData.registrationNumber.trim() || !clientFormData.address.trim()) {
      toast.error("All organisation details are required");
      return;
    }

    updateClientProfile.mutate(
      {
        name: clientFormData.name.trim(),
        email: clientFormData.email.trim(),
        phone: clientFormData.phone.trim(),
        organisationName: clientFormData.organisationName.trim(),
        registrationNumber: clientFormData.registrationNumber.trim(),
        address: clientFormData.address.trim(),
      },
      {
        onSuccess: async () => {
          setClientInitialFormData({ ...clientFormData });
          const auth = await authService.getCurrentAuth();
          if (auth?.user) {
            window.location.reload();
          }
          toast.success("Profile updated successfully");
        },
        onError: (error) => {
          toast.error("Failed to update profile", {
            description: error instanceof Error ? error.message : "Please try again.",
          });
        },
      }
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-muted-foreground">Manage your contact and organisation profile information</p>
      </div>

      <Card id="settings-profile" className="scroll-mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>Update your contact and organisation details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingClient ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div>
                <h4 className="mb-3 text-sm font-medium">Contact Information</h4>
                <div className="mb-4 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="clientName">Contact Name</Label>
                    <Input
                      id="clientName"
                      value={clientFormData.name}
                      onChange={(e) => setClientFormData((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="clientEmail">Email Address</Label>
                    <Input
                      id="clientEmail"
                      type="email"
                      value={clientFormData.email}
                      onChange={(e) => setClientFormData((prev) => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientPhone">Phone Number</Label>
                    <Input
                      id="clientPhone"
                      type="tel"
                      value={clientFormData.phone}
                      onChange={(e) => setClientFormData((prev) => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <Building2 className="h-4 w-4" />
                  Organisation Information
                </h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="orgName">Organisation Name</Label>
                    <Input
                      id="orgName"
                      value={clientFormData.organisationName}
                      onChange={(e) => setClientFormData((prev) => ({ ...prev, organisationName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regNumber">Registration Number</Label>
                    <Input
                      id="regNumber"
                      value={clientFormData.registrationNumber}
                      onChange={(e) => setClientFormData((prev) => ({ ...prev, registrationNumber: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <Label htmlFor="address">Registered Address</Label>
                  <Input
                    id="address"
                    value={clientFormData.address}
                    onChange={(e) => setClientFormData((prev) => ({ ...prev, address: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSave} disabled={updateClientProfile.isPending || !hasClientProfileChanges}>
                  {updateClientProfile.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Profile
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;
