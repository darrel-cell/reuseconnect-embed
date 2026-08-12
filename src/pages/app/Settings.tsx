import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Building2, 
  Bell, 
  Link2, 
  Shield,
  Save,
  Settings as SettingsIcon,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { authService } from "@/services/auth.service";
import { useShowPasswordHints } from "@/hooks/useShowPasswordHints";

// Default notification preferences used for initial state and "unsaved changes" checks
const defaultNotifications = {
  email: true,
  jobAssignments: true,
  routeUpdates: true,
  collectionReminders: true,
  certificateAvailability: true,
  esgReports: false,
  clientActivity: true,
};

/**
 * Feature switches for two sections whose backend does not exist yet.
 *
 * The markup is kept rather than deleted so it does not have to be rebuilt;
 * flipping either of these to true is all that should be needed once the
 * corresponding API lands. Previously written as a literal `{false && ...}`,
 * which read as dead code with no explanation.
 */
const SHOW_NOTIFICATION_PREFERENCES = false;
const SHOW_INTEGRATIONS = false;

const Settings = () => {
  const { user } = useAuth();
  const isReseller = user?.role === 'partner';
  const isAdmin = user?.role === 'admin';
  const isClient = user?.role === 'client';
  const isDriver = user?.role === 'driver';

  const [notifications, setNotifications] = useState(defaultNotifications);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    new: '',
    confirm: '',
  });
  const { showHints: showNewPasswordHints, passwordInputProps: newPasswordInputProps } =
    useShowPasswordHints(passwordForm.new);
  const { showHints: showConfirmPasswordHints, passwordInputProps: confirmPasswordInputProps } =
    useShowPasswordHints(passwordForm.confirm);
  const showPasswordHints = showNewPasswordHints || showConfirmPasswordHints;
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleNotificationChange = (key: keyof typeof notifications, value: boolean) => {
    setNotifications(prev => ({ ...prev, [key]: value }));
    toast.success(`Notification ${value ? 'enabled' : 'disabled'}`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="text-2xl font-bold text-foreground">Settings</h2>
        <p className="text-muted-foreground">
          Manage your account security, notification preferences, and platform configuration
        </p>
      </motion.div>

      {/* Notifications — parked until the notification-preferences API exists. */}
      {SHOW_NOTIFICATION_PREFERENCES && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: isDriver ? 0.2 : 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
              <CardDescription>
                Configure how and when you receive updates. Toggle notifications on or off as needed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Common notifications - Email */}
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="flex-1">
                  <p className="font-medium mb-1">Email notifications</p>
                  <p className="text-sm text-muted-foreground">
                    {isDriver && "Receive updates about assigned jobs"}
                    {!isDriver && "Receive updates about job status changes"}
                  </p>
                </div>
                <Switch 
                  checked={notifications.email}
                  onCheckedChange={(checked) => handleNotificationChange('email', checked)}
                  className="data-[state=checked]:bg-success"
                />
              </div>
              
              {/* Driver-specific notifications */}
              {isDriver && (
                <>
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <p className="font-medium mb-1">Job assignments</p>
                      <p className="text-sm text-muted-foreground">Get notified when new jobs are assigned to you</p>
                    </div>
                    <Switch 
                      checked={notifications.jobAssignments}
                      onCheckedChange={(checked) => handleNotificationChange('jobAssignments', checked)}
                      className="data-[state=checked]:bg-success"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <p className="font-medium mb-1">Route updates</p>
                      <p className="text-sm text-muted-foreground">Receive updates about route changes or delays</p>
                    </div>
                    <Switch 
                      checked={notifications.routeUpdates}
                      onCheckedChange={(checked) => handleNotificationChange('routeUpdates', checked)}
                      className="data-[state=checked]:bg-success"
                    />
                  </div>
                </>
              )}
              
              {/* Client/Reseller/Admin notifications */}
              {!isDriver && (
                <>
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <p className="font-medium mb-1">Collection reminders</p>
                      <p className="text-sm text-muted-foreground">Get notified 24h before scheduled collections</p>
                    </div>
                    <Switch 
                      checked={notifications.collectionReminders}
                      onCheckedChange={(checked) => handleNotificationChange('collectionReminders', checked)}
                      className="data-[state=checked]:bg-success"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <p className="font-medium mb-1">Certificate availability</p>
                      <p className="text-sm text-muted-foreground">Notify when new certificates are ready</p>
                    </div>
                    <Switch 
                      checked={notifications.certificateAvailability}
                      onCheckedChange={(checked) => handleNotificationChange('certificateAvailability', checked)}
                      className="data-[state=checked]:bg-success"
                    />
                  </div>
                  {(isAdmin || isClient) && (
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="flex-1">
                        <p className="font-medium mb-1">ESG report summaries</p>
                        <p className="text-sm text-muted-foreground">Weekly environmental impact digests</p>
                      </div>
                      <Switch 
                        checked={notifications.esgReports}
                        onCheckedChange={(checked) => handleNotificationChange('esgReports', checked)}
                        className="data-[state=checked]:bg-success"
                      />
                    </div>
                  )}
                  {isReseller && (
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="flex-1">
                        <p className="font-medium mb-1">Client activity</p>
                        <p className="text-sm text-muted-foreground">Get notified about your clients' bookings and jobs</p>
                      </div>
                      <Switch 
                        checked={notifications.clientActivity}
                        onCheckedChange={(checked) => handleNotificationChange('clientActivity', checked)}
                        className="data-[state=checked]:bg-success"
                      />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Integrations — parked until there is an integration to configure. */}
      {SHOW_INTEGRATIONS && isAdmin && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Link2 className="h-5 w-5" />
                Integrations
              </CardTitle>
              <CardDescription>
                Manage platform-wide system integrations with external services
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                    <span className="text-lg">📊</span>
                  </div>
                  <div>
                    <p className="font-medium">ERP System</p>
                    <p className="text-sm text-muted-foreground">
                      Platform ERP integration for automated data synchronization
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-success/10 text-success">Connected</Badge>
                  <Button variant="outline" size="sm">
                    <SettingsIcon className="h-4 w-4 mr-2" />
                    Configure
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                    <span className="text-lg">💾</span>
                  </div>
                  <div>
                    <p className="font-medium">Blancco Data Wipe</p>
                    <p className="text-sm text-muted-foreground">
                      Sanitisation system integration for automated certificate generation
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-success/10 text-success">Connected</Badge>
                  <Button variant="outline" size="sm">
                    <SettingsIcon className="h-4 w-4 mr-2" />
                    Configure
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Security - For all roles */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: isDriver ? 0.3 : 0.5 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-5 w-5" />
              Security & Password
            </CardTitle>
            <CardDescription>
              Keep your account secure by updating your password regularly
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {/* Current Password */}
            <div className="space-y-2">
              <Label htmlFor="currentPassword" className="text-sm font-semibold">
                Current Password
              </Label>
              <div className="relative">
                <Input 
                  id="currentPassword" 
                  type={showPasswords.current ? "text" : "password"} 
                  placeholder="Enter your current password"
                  value={passwordForm.current}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, current: e.target.value }))}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                >
                  {showPasswords.current ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            {/* New Password Section */}
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold mb-3 block">New Password</Label>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword" className="text-xs text-muted-foreground">
                      New Password
                    </Label>
                    <div className="relative">
                      <Input 
                        id="newPassword" 
                        type={showPasswords.new ? "text" : "password"} 
                        placeholder="Create a strong password"
                        value={passwordForm.new}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, new: e.target.value }))}
                        className="pr-10"
                        {...newPasswordInputProps}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                      >
                        {showPasswords.new ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-xs text-muted-foreground">
                      Confirm Password
                    </Label>
                    <div className="relative">
                      <Input 
                        id="confirmPassword" 
                        type={showPasswords.confirm ? "text" : "password"} 
                        placeholder="Re-enter your new password"
                        value={passwordForm.confirm}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm: e.target.value }))}
                        className="pr-10"
                        {...confirmPasswordInputProps}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                      >
                        {showPasswords.confirm ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {showPasswordHints && (
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-start gap-2 mb-3">
                  <Shield className="h-4 w-4 text-primary mt-0.5" />
                  <p className="text-sm font-semibold text-foreground">Password Requirements</p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    {passwordForm.new.length >= 8 ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span className={passwordForm.new.length >= 8 ? "text-success font-medium" : "text-destructive"}>
                      At least 8 characters
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/[A-Z]/.test(passwordForm.new) ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span className={/[A-Z]/.test(passwordForm.new) ? "text-success font-medium" : "text-destructive"}>
                      One uppercase letter
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/[a-z]/.test(passwordForm.new) ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span className={/[a-z]/.test(passwordForm.new) ? "text-success font-medium" : "text-destructive"}>
                      One lowercase letter
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/\d/.test(passwordForm.new) ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span className={/\d/.test(passwordForm.new) ? "text-success font-medium" : "text-destructive"}>
                      One number
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(passwordForm.new) ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span className={/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(passwordForm.new) ? "text-success font-medium" : "text-destructive"}>
                      One special character
                    </span>
                  </div>
                  {passwordForm.confirm && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-primary/10">
                      {passwordForm.new === passwordForm.confirm ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      )}
                      <span className={passwordForm.new === passwordForm.confirm ? "text-success font-medium" : "text-destructive"}>
                        Passwords match
                      </span>
                    </div>
                  )}
                </div>
              </div>
              )}
            </div>

            {/* Action Button */}
            <div className="flex justify-end pt-4 border-t">
              <Button 
                variant="default" 
                size="lg"
                disabled={
                  isChangingPassword ||
                  !passwordForm.current?.trim() || 
                  !passwordForm.new?.trim() || 
                  !passwordForm.confirm?.trim() ||
                  passwordForm.new !== passwordForm.confirm ||
                  passwordForm.new.length < 8 || 
                  !/[A-Z]/.test(passwordForm.new) || 
                  !/[a-z]/.test(passwordForm.new) || 
                  !/\d/.test(passwordForm.new)
                }
                onClick={async () => {
                  if (!passwordForm.current) {
                    toast.error("Please enter your current password");
                    return;
                  }
                  if (!passwordForm.new) {
                    toast.error("Please enter a new password");
                    return;
                  }
                  if (passwordForm.new !== passwordForm.confirm) {
                    toast.error("Passwords do not match");
                    return;
                  }
                  if (passwordForm.new.length < 8 || !/[A-Z]/.test(passwordForm.new) || !/[a-z]/.test(passwordForm.new) || !/\d/.test(passwordForm.new)) {
                    toast.error("Password does not meet requirements");
                    return;
                  }

                  setIsChangingPassword(true);
                  try {
                    await authService.changePassword(passwordForm.current, passwordForm.new);
                    toast.success("Password updated successfully", {
                      description: "Your password has been changed. Please use your new password for future logins.",
                    });
                    setPasswordForm({ current: '', new: '', confirm: '' });
                  } catch (error) {
                    // Extract error message, prioritizing field-specific errors (especially password)
                    let errorMessage = "Failed to change password. Please try again.";
                    
                    if (error?.message) {
                      errorMessage = error.message;
                      
                      // Check if it's an ApiError with field-specific errors
                      if (error.fields) {
                        const fields = error.fields as Record<string, string>;
                        // Prioritize newPassword error if present
                        if (fields.newPassword) {
                          errorMessage = fields.newPassword;
                        } else {
                          // Use the first field error if no newPassword error
                          const firstFieldError = Object.values(fields)[0];
                          if (firstFieldError) {
                            errorMessage = firstFieldError;
                          }
                        }
                      }
                    }
                    
                    toast.error("Failed to change password", {
                      description: errorMessage,
                    });
                  } finally {
                    setIsChangingPassword(false);
                  }
                }}
                className="min-w-[160px]"
              >
                {isChangingPassword ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    Update Password
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Settings;
