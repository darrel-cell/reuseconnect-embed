import { useState, useMemo, useRef, useEffect } from "react";
import { Upload, RefreshCw, Filter, Search, Plus, EllipsisVertical, Edit2, FileUp, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useInventoryPage, useUploadInventory, useSyncInventory } from "@/hooks/useInventory";
import { ListPagination } from "@/components/common/ListPagination";
import { useAssetCategories } from "@/hooks/useAssets";
import { useClients } from "@/hooks/useClients";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { InventoryItem, inventoryService, type InventoryLookupResult } from "@/services/inventory.service";
import { compareInventoryIdentity } from "@/lib/serial-inventory-compare";
import { SerialInventorySnapshot } from "@/components/inventory/SerialInventorySnapshot";

const Inventory = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [inventoryPage, setInventoryPage] = useState(1);
  const [inventoryLimit, setInventoryLimit] = useState(20);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Load clients for admin
  const { data: allClients = [] } = useClients({ status: 'active' });
  const clients = useMemo(() => {
    return allClients.filter(client => client.status === 'active');
  }, [allClients]);
  
  // Use selected clientId for admin (optional), undefined for client users (they see their own)
  // Paged: /inventory used to return every device row for the tenant.
  const { inventory, pagination, isLoading, isFetching } = useInventoryPage({
    allocatedTo: isAdmin ? (selectedClientId || undefined) : undefined,
    page: inventoryPage,
    limit: inventoryLimit,
  });
  const { data: assetCategories = [] } = useAssetCategories();
  const uploadInventory = useUploadInventory();
  const syncInventory = useSyncInventory();

  // Helpers: match category by API name or legacy lowercase (for CSV/backward compatibility)
  const requiresDeviceType = (name: string) =>
    ['Laptop', 'Desktop'].includes(name) || ['laptop', 'desktop'].includes(name?.toLowerCase());
  const requiresImei = (name: string) =>
    ['Smart Phones', 'Tablets'].includes(name) || ['mobile', 'tablet'].includes(name?.toLowerCase());
  
  const [searchTerm, setSearchTerm] = useState("");
  const [deviceTypeFilter, setDeviceTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [conditionCodeFilter, setConditionCodeFilter] = useState<string>("all");
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(20);
  const [page, setPage] = useState(1);
  
  // Manual Add form state
  const [manualForm, setManualForm] = useState({
    category: "",
    deviceType: "", // Windows/Apple for Laptop and Desktop
    make: "",
    model: "",
    serialNumber: "",
    conditionCode: "",
    imei: "",
    clientId: "",
  });
  const [serialDetailLookup, setSerialDetailLookup] = useState<InventoryLookupResult | null>(null);
  const [serialDetailLoading, setSerialDetailLoading] = useState(false);

  const inventoryIdentityMismatches = useMemo(() => {
    if (!serialDetailLookup || !serialDetailLookup.found) return [];
    const inv = serialDetailLookup.inventory;
    return compareInventoryIdentity(
      {
        category: manualForm.category,
        make: manualForm.make,
        model: manualForm.model,
        deviceType: requiresDeviceType(manualForm.category) ? manualForm.deviceType : null,
        imei: manualForm.imei,
        conditionCode: manualForm.conditionCode,
      },
      {
        category: inv.category,
        make: inv.make,
        model: inv.model,
        deviceType: inv.deviceType,
        imei: inv.imei,
        conditionCode: inv.conditionCode,
      }
    );
  }, [serialDetailLookup, manualForm]);

  const fetchManualSerialLookup = async () => {
    const sn = manualForm.serialNumber.trim();
    if (!sn) {
      setSerialDetailLookup(null);
      return;
    }
    setSerialDetailLoading(true);
    try {
      const clientId = isAdmin ? manualForm.clientId || undefined : undefined;
      const res = await inventoryService.lookupBySerial(sn, clientId);
      setSerialDetailLookup(res);
      if (res.found) {
        const inv = res.inventory;
        // Serial-first flow: when serial exists, populate the form from the canonical DB identity.
        setManualForm((f) => ({
          ...f,
          serialNumber: sn,
          category: inv.category,
          deviceType: requiresDeviceType(inv.category) ? inv.deviceType || "" : "",
          make: inv.make,
          model: inv.model,
          imei: inv.imei || "",
          conditionCode: inv.conditionCode,
        }));
      }
    } finally {
      setSerialDetailLoading(false);
    }
  };

  const applyDatabaseIdentity = () => {
    if (!serialDetailLookup || !serialDetailLookup.found) return;
    const inv = serialDetailLookup.inventory;
    setManualForm((f) => ({
      ...f,
      category: inv.category,
      deviceType: requiresDeviceType(inv.category) ? inv.deviceType || "" : "",
      make: inv.make,
      model: inv.model,
      imei: inv.imei || "",
    }));
  };

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const matchesSearch = 
        item.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.serialNumber.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDeviceType = deviceTypeFilter === "all" || item.category === deviceTypeFilter;
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesConditionCode = conditionCodeFilter === "all" || item.conditionCode === conditionCodeFilter;
      
      // Client filter (using allocatedTo)
      let matchesClient = true;
      if (isAdmin && selectedClientId && selectedClientId !== "__all__") {
        if (selectedClientId === "__unallocated__") {
          matchesClient = !item.allocatedTo;
        } else {
          matchesClient = item.allocatedTo === selectedClientId;
        }
      }

      return matchesSearch && matchesDeviceType && matchesStatus && matchesConditionCode && matchesClient;
    });
  }, [inventory, searchTerm, deviceTypeFilter, statusFilter, conditionCodeFilter, selectedClientId, isAdmin]);

  const totalFiltered = filteredInventory.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const paginatedInventory = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredInventory.slice(start, start + pageSize);
  }, [filteredInventory, page, pageSize]);

  // Reset to page 1 when filters or page size change (page may be out of range)
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const handleManualAdd = () => {
    if (!manualForm.category || !manualForm.make || !manualForm.model || !manualForm.serialNumber || !manualForm.conditionCode) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Device Type is required for Laptop and Desktop
    if (requiresDeviceType(manualForm.category) && !manualForm.deviceType) {
      toast.error("Device Type (Windows/Apple) is required for Laptop and Desktop");
      return;
    }

    // IMEI is required for mobile devices
    if (requiresImei(manualForm.category) && !manualForm.imei) {
      toast.error("IMEI is required for mobile devices");
      return;
    }

    // Determine status: if client is selected, set to allocated, otherwise available
    const status = (isAdmin && manualForm.clientId) ? 'allocated' : 'available';

    const items = [{
      category: manualForm.category,
      deviceType: requiresDeviceType(manualForm.category) ? manualForm.deviceType : null,
      make: manualForm.make,
      model: manualForm.model,
      serialNumber: manualForm.serialNumber,
      imei: manualForm.imei || undefined,
      conditionCode: manualForm.conditionCode,
      status: status,
    }];

    const normalizedSerial = manualForm.serialNumber.trim().toLowerCase();
    const alreadyExists = inventory.some((item) => item.serialNumber.trim().toLowerCase() === normalizedSerial);
    if (alreadyExists) {
      toast.info("Serial already exists - device will be updated", {
        description: "Existing inventory data for this serial number will be overwritten.",
      });
    }

    uploadInventory.mutate({ 
      items,
      clientId: isAdmin ? (manualForm.clientId || undefined) : undefined
    }, {
      onSuccess: () => {
        setManualForm({
          category: "",
          deviceType: "",
          make: "",
          model: "",
          serialNumber: "",
          conditionCode: "",
          imei: "",
          clientId: "",
        });
        setShowAddDevice(false);
        // Reset filters to show the newly added item
        // If a client was selected, keep that filter; otherwise show all
        if (!isAdmin || !manualForm.clientId) {
          setSelectedClientId("");
        }
        // Reset deviceType filter to show all
        setDeviceTypeFilter("all");
      }
    });
  };

  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.trim().split('\n');
      const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
      
      // Validate CSV format - should match manual form fields
      const requiredHeaders = ['category', 'make', 'model', 'serialnumber', 'conditioncode'];
      const hasAllRequired = requiredHeaders.every(header => 
        headers.some(h => h.includes(header.replace('serialnumber', 'serial').replace('conditioncode', 'condition')))
      );

      if (!hasAllRequired) {
        toast.error("CSV format invalid. Required columns: category, make, model, serialNumber, conditionCode");
        return;
      }

      // Find column indices
      const categoryIdx = headers.findIndex(h => h.includes('category'));
      const deviceTypeIdx = headers.findIndex(h => h.includes('devicetype') || (h.includes('device') && h.includes('type')));
      const makeIdx = headers.findIndex(h => h.includes('make'));
      const modelIdx = headers.findIndex(h => h.includes('model'));
      const serialIdx = headers.findIndex(h => h.includes('serial'));
      const imeiIdx = headers.findIndex(h => h.includes('imei'));
      const conditionIdx = headers.findIndex(h => h.includes('condition') || h.includes('code'));
      const clientIdx = headers.findIndex(h => h.includes('client'));

      if (makeIdx === -1 || modelIdx === -1 || serialIdx === -1 || categoryIdx === -1 || conditionIdx === -1) {
        toast.error("CSV must contain columns: category, make, model, serialNumber, conditionCode");
        return;
      }

      const parsedItems = lines.slice(1).map((line, index) => {
        const values = line.split(',').map(v => v.trim());
        const categoryInput = values[categoryIdx]?.trim() || '';
        // Normalize to API category name (e.g. "laptop" -> "Laptop", "voip" -> "VOIP")
        const category = assetCategories.find(c => c.name.toLowerCase() === categoryInput.toLowerCase())?.name ?? categoryInput;

        // Validate required fields based on category
        if (requiresDeviceType(category) && deviceTypeIdx >= 0 && !values[deviceTypeIdx]) {
          toast.error(`Row ${index + 2}: Device Type (Windows/Apple) is required for ${category}`);
          return null;
        }

        if (requiresImei(category) && imeiIdx >= 0 && !values[imeiIdx]) {
          toast.error(`Row ${index + 2}: IMEI is required for ${category}`);
          return null;
        }

        const deviceType = requiresDeviceType(category) && deviceTypeIdx >= 0 && values[deviceTypeIdx]
          ? values[deviceTypeIdx]
          : null;
        
        // Determine status: if client is selected, set to allocated, otherwise available
        const clientIdFromRow = clientIdx >= 0 ? values[clientIdx]?.trim() : "";
        const status = clientIdFromRow ? 'allocated' : 'available';
        
        return {
          category,
          deviceType,
          make: values[makeIdx],
          model: values[modelIdx],
          serialNumber: values[serialIdx],
          imei: imeiIdx >= 0 ? values[imeiIdx] : undefined,
          conditionCode: values[conditionIdx],
          status: status,
        };
      }).filter((item): item is NonNullable<typeof item> => 
        Boolean(item !== null && item.make && item.model && item.serialNumber && item.conditionCode)
      );

      if (parsedItems.length === 0) {
        toast.error("No valid items found in CSV");
        return;
      }

      // Keep only the latest row for each serial number (overwrite semantics within same CSV file).
      const latestBySerial = new Map<string, (typeof parsedItems)[number]>();
      let duplicateRowsInCsv = 0;
      for (const item of parsedItems) {
        const key = item.serialNumber.trim().toLowerCase();
        if (!key) continue;
        if (latestBySerial.has(key)) duplicateRowsInCsv += 1;
        latestBySerial.set(key, item);
      }
      const items = Array.from(latestBySerial.values());

      if (duplicateRowsInCsv > 0) {
        toast.info("Duplicate serials found in CSV", {
          description: `${duplicateRowsInCsv} duplicate row(s) detected. Latest row per serial will overwrite earlier rows.`,
        });
      }

      // Use clientId from first row if available, or from selectedClientId
      const firstRowClientId = lines[1]?.split(',')[clientIdx]?.trim() || "";
      const clientIdToUse = firstRowClientId || (isAdmin ? (selectedClientId || undefined) : undefined);

      uploadInventory.mutate({ 
        items,
        clientId: clientIdToUse
      }, {
        onSuccess: () => {
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          setShowAddDevice(false);
          // Reset filters to show the newly added items
          setDeviceTypeFilter("all");
        }
      });
    };

    reader.onerror = () => {
      toast.error("Error reading CSV file");
    };

    reader.readAsText(file);
  };

  const handleSync = () => {
    syncInventory.mutate(isAdmin ? (selectedClientId || null) : undefined);
  };

  const handleEdit = (item: InventoryItem) => {
    // TODO: Implement edit functionality
    toast.info("Edit functionality coming soon");
  };

  const statusColors: Record<string, string> = {
    available: "bg-green-500/10 text-green-500",
    allocated: "bg-blue-500/10 text-blue-500",
    delivered: "bg-purple-500/10 text-purple-500",
    mover_allocated: "bg-amber-500/10 text-amber-500",
  };

  // Category filter: show all API categories plus any in inventory (so VOIP, WEEE Waste appear even with 0 items)
  const uniqueDeviceTypes = useMemo(() => {
    const fromInventory = Array.from(new Set(inventory.map(item => item.category)));
    const fromApi = assetCategories.map(c => c.name);
    return Array.from(new Set([...fromApi, ...fromInventory])).sort();
  }, [inventory, assetCategories]);

  const uniqueConditionCodes = useMemo(() => {
    return Array.from(new Set(inventory.map(item => item.conditionCode))).sort();
  }, [inventory]);

  // Get category and capitalize first letter
  const getCategory = (category: string) => {
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  // Get device type display (Windows/Apple for laptop/desktop, or "-" for others)
  const getDeviceTypeDisplay = (deviceType: string | null) => {
    if (!deviceType) return "-";
    return deviceType; // Already "Windows" or "Apple"
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground">
            Manage your laptop and mobile phone inventory
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSync} disabled={syncInventory.isPending}>
            <RefreshCw className={`mr-2 h-4 w-4 ${syncInventory.isPending ? 'animate-spin' : ''}`} />
            Sync with ReuseOS
          </Button>
          <Button onClick={() => setShowAddDevice(!showAddDevice)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Device
          </Button>
        </div>
      </div>

      {showAddDevice && (
        <Card>
          <CardHeader>
            <CardTitle>Add Device</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="manual" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="manual">Manual Add</TabsTrigger>
                <TabsTrigger value="csv">CSV Upload</TabsTrigger>
              </TabsList>
              <TabsContent value="manual" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="serialNumber">Serial Number *</Label>
                    <Input
                      id="serialNumber"
                      value={manualForm.serialNumber}
                      onChange={(e) => {
                        setManualForm({ ...manualForm, serialNumber: e.target.value });
                        setSerialDetailLookup(null);
                      }}
                      onBlur={() => void fetchManualSerialLookup()}
                      placeholder="Enter serial first to fetch existing device details"
                      className="font-mono"
                    />
                    <SerialInventorySnapshot
                      lookup={serialDetailLookup}
                      mismatches={inventoryIdentityMismatches}
                      loading={serialDetailLoading}
                      variant="inventory"
                    />
                    {serialDetailLookup?.found && (
                      <Button type="button" variant="secondary" size="sm" onClick={applyDatabaseIdentity}>
                        Apply database values
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Select 
                      value={manualForm.category} 
                      onValueChange={(value) => {
                        // Reset deviceType and imei when category changes
                        const resetDeviceType = !requiresDeviceType(value);
                        const resetImei = !requiresImei(value);
                        setManualForm({ 
                          ...manualForm, 
                          category: value,
                          deviceType: resetDeviceType ? "" : manualForm.deviceType,
                          imei: resetImei ? "" : manualForm.imei
                        });
                      }}
                    >
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {assetCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.name}>
                            {cat.icon ? `${cat.icon} ` : ""}{cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {requiresDeviceType(manualForm.category) && (
                    <div className="space-y-2">
                      <Label htmlFor="deviceType">Device Type *</Label>
                      <Select 
                        value={manualForm.deviceType} 
                        onValueChange={(value) => setManualForm({ ...manualForm, deviceType: value })}
                      >
                        <SelectTrigger id="deviceType">
                          <SelectValue placeholder="Select device type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Windows">Windows</SelectItem>
                          <SelectItem value="Apple">Apple</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="make">Device Make *</Label>
                    <Input
                      id="make"
                      value={manualForm.make}
                      onChange={(e) => setManualForm({ ...manualForm, make: e.target.value })}
                      placeholder="e.g., Dell, Apple"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model">Device Model *</Label>
                    <Input
                      id="model"
                      value={manualForm.model}
                      onChange={(e) => setManualForm({ ...manualForm, model: e.target.value })}
                      placeholder="e.g., Latitude 7420, iPhone 14"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conditionCode">Condition Code *</Label>
                    <Input
                      id="conditionCode"
                      value={manualForm.conditionCode}
                      onChange={(e) => setManualForm({ ...manualForm, conditionCode: e.target.value.toUpperCase() })}
                      placeholder="e.g., IBMA, IBMB"
                    />
                  </div>
                  {requiresImei(manualForm.category) && (
                    <div className="space-y-2">
                      <Label htmlFor="imei">IMEI *</Label>
                      <Input
                        id="imei"
                        value={manualForm.imei}
                        onChange={(e) => setManualForm({ ...manualForm, imei: e.target.value })}
                        placeholder="IMEI number"
                        className="font-mono"
                      />
                    </div>
                  )}
                  {isAdmin && (
                    <div className="space-y-2">
                      <Label htmlFor="clientId">Client (Optional)</Label>
                      <Select 
                        value={manualForm.clientId || "__unallocated__"} 
                        onValueChange={(value) => setManualForm({ ...manualForm, clientId: value === "__unallocated__" ? "" : value })}
                      >
                        <SelectTrigger id="clientId">
                          <SelectValue placeholder="Select client" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__unallocated__">Unallocated</SelectItem>
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.organisationName || client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleManualAdd} disabled={uploadInventory.isPending}>
                    Add Device
                  </Button>
                  <Button variant="outline" onClick={() => setShowAddDevice(false)}>
                    Cancel
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="csv" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>CSV File Format</Label>
                  <p className="text-sm text-muted-foreground">
                    Required columns: category, make, model, serialNumber, conditionCode<br />
                    Optional columns: deviceType (required if category is laptop or desktop), imei (required if category is mobile or tablet), clientId<br />
                    Categories: use exact names from the dropdown (e.g. Laptop, Desktop, Smart Phones, Tablets, Server, Storage, Routers & Switches, Other networking, VOIP, WEEE Waste); lowercase is also accepted.
                  </p>
                  <div className="text-xs font-mono bg-muted p-2 rounded">
                    category,deviceType,make,model,serialNumber,conditionCode,imei,clientId<br />
                    laptop,Windows,Dell,Latitude 7420,ABC123,IBMA,<br />
                    mobile,Apple,iPhone 14,DEF456,IBMB,123456789,
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="csv-file">Upload CSV File</Label>
                  <Input
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    ref={fileInputRef}
                    onChange={handleCSVUpload}
                    className="cursor-pointer"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowAddDevice(false)}>
                    Cancel
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Inventory List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by make, model, or serial..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            {isAdmin && (
              <Select value={selectedClientId || "__all__"} onValueChange={(value) => setSelectedClientId(value === "__all__" ? "" : value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Clients</SelectItem>
                  <SelectItem value="__unallocated__">Unallocated</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.organisationName || client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={deviceTypeFilter} onValueChange={setDeviceTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {uniqueDeviceTypes.map(type => (
                  <SelectItem key={type} value={type}>{getCategory(type)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="allocated">Allocated</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="mover_allocated">Mover Allocated</SelectItem>
              </SelectContent>
            </Select>
            <Select value={conditionCodeFilter} onValueChange={setConditionCodeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Condition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Conditions</SelectItem>
                {uniqueConditionCodes.map(code => (
                  <SelectItem key={code} value={code}>{code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isAdmin && totalFiltered > 0 && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Show</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    setPageSize(Number(value) as 10 | 20 | 50);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[90px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">per page</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                  {totalFiltered > 0 && (
                    <span className="ml-1">
                      ({totalFiltered} device{totalFiltered !== 1 ? 's' : ''})
                    </span>
                  )}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : filteredInventory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No inventory items found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Make</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>Device Type</TableHead>
                  <TableHead>IMEI</TableHead>
                  <TableHead>Condition Code</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead className="w-[50px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(isAdmin ? paginatedInventory : filteredInventory).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{getCategory(item.category)}</TableCell>
                    {(() => {
                      const isAccessory = String(item.category || "")
                        .trim()
                        .toLowerCase()
                        .includes("accessor");

                      const makeRaw = String(item.make || "").trim();
                      const modelRaw = String(item.model || "").trim();
                      const conditionRaw = String(item.conditionCode || "").trim();

                      const makeDisplay =
                        isAccessory && (!makeRaw || makeRaw.toLowerCase() === "unknown") ? "-" : item.make;
                      const modelDisplay =
                        isAccessory && (!modelRaw || modelRaw.toLowerCase() === "unknown") ? "-" : item.model;

                      return (
                        <>
                          <TableCell>{makeDisplay}</TableCell>
                          <TableCell>{modelDisplay}</TableCell>
                        </>
                      );
                    })()}
                    <TableCell className="font-mono">{item.serialNumber}</TableCell>
                    <TableCell>{getDeviceTypeDisplay(item.deviceType)}</TableCell>
                    <TableCell className="font-mono">{item.imei || '-'}</TableCell>
                    {(() => {
                      const isAccessory = String(item.category || "")
                        .trim()
                        .toLowerCase()
                        .includes("accessor");
                      const conditionRaw = String(item.conditionCode || "").trim();

                      const conditionUpper = conditionRaw.toUpperCase();
                      const isMissingOrPlaceholder =
                        !conditionRaw ||
                        conditionUpper === "UNKA" ||
                        conditionUpper === "UNKNOWN" ||
                        conditionUpper === "UNK" ||
                        conditionUpper === "NA" ||
                        conditionUpper === "-";

                      return (
                        <TableCell>
                          {isAccessory && isMissingOrPlaceholder ? "-" : item.conditionCode}
                        </TableCell>
                      );
                    })()}
                    <TableCell>
                      <Badge className={statusColors[item.status] || ''}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <EllipsisVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(item)}>
                              <Edit2 className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ListPagination
        pagination={pagination}
        onPageChange={setInventoryPage}
        onLimitChange={(l) => { setInventoryLimit(l); setInventoryPage(1); }}
        itemLabel="devices"
        isLoading={isFetching}
      />
    </div>
  );
};

export default Inventory;
