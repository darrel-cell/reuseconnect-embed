import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Download,
  Search,
  Filter,
  Shield,
  Link as LinkIcon,
  ChevronDown,
  Briefcase,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useJobs } from "@/hooks/useJobs";
import { useDocuments } from "@/hooks/useDocuments";
import { documentsService } from "@/services/documents.service";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Document as DocumentType } from "@/services/documents.service";
import { toast } from "sonner";

const docTypeConfig: Record<
  string,
  { label: string; icon: typeof FileText; color: string }
> = {
  "chain-of-custody": {
    label: "Chain of Custody",
    icon: LinkIcon,
    color: "bg-info/10 text-info",
  },
  toc: {
    label: "Transfer of Custody",
    icon: FileText,
    color: "bg-warning/10 text-warning",
  },
  certificate: {
    label: "Certificate",
    icon: Shield,
    color: "bg-primary/10 text-primary",
  },
  "grading-report": {
    label: "Grading report",
    icon: FileText,
    color: "bg-success/10 text-success",
  },
  other: {
    label: "Other",
    icon: FileText,
    color: "bg-muted text-muted-foreground",
  },
};

type CombinedDoc = {
  id: string;
  jobId: string;
  jobNumber: string;
  clientName: string;
  type: string;
  generatedDate: string;
  downloadUrl: string;
  isApiDocument: boolean;
  displayTitle?: string;
};

const Documents = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [openJobIds, setOpenJobIds] = useState<Set<string>>(() => new Set());
  const { data: jobs = [], isLoading: isLoadingJobs } = useJobs();
  const { data: apiDocuments = [], isLoading: isLoadingDocuments, error } = useDocuments();

  const jobCertificates = jobs.flatMap((job) =>
    job.certificates.map((cert, index) => ({
      id: `${job.id}-${cert.type}-${index}`,
      jobId: job.id,
      jobNumber: job.erpJobNumber,
      clientName: job.organisationName,
      type: cert.type as string,
      generatedDate: cert.generatedDate,
      downloadUrl: cert.downloadUrl,
      isApiDocument: false,
      displayTitle: undefined as string | undefined,
    }))
  );

  const apiDocs = apiDocuments.map((doc: DocumentType) => ({
    id: doc.id,
    jobId: doc.jobId || "",
    jobNumber: doc.job?.erpJobNumber || doc.booking?.bookingNumber || "N/A",
    clientName:
      doc.job?.organisationName ||
      doc.booking?.client?.organisationName ||
      doc.job?.clientName ||
      doc.booking?.client?.name ||
      "N/A",
    displayTitle: doc.name,
    type: doc.type,
    generatedDate: doc.createdAt,
    downloadUrl: documentsService.getDownloadUrl(doc.id),
    isApiDocument: true,
  }));

  const allDocuments = [...apiDocs, ...jobCertificates];
  const uniqueDocuments = Array.from(new Map(allDocuments.map((doc) => [doc.id, doc])).values());

  const isLoading = isLoadingJobs || isLoadingDocuments;

  const filters = [
    { value: "all", label: "All Documents" },
    { value: "chain-of-custody", label: "Chain of Custody" },
    { value: "toc", label: "Transfer of Custody" },
    { value: "certificate", label: "Certificate" },
    { value: "grading-report", label: "Grading report" },
    { value: "other", label: "Other" },
  ];

  const filteredDocs = uniqueDocuments.filter((doc) => {
    const matchesSearch =
      doc.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.jobNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === "all" || doc.type === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const jobsSorted = useMemo(
    () =>
      [...jobs].sort((a, b) =>
        (a.erpJobNumber || "").localeCompare(b.erpJobNumber || "", undefined, { numeric: true })
      ),
    [jobs]
  );

  const docsByJobId = useMemo(() => {
    const m = new Map<string, CombinedDoc[]>();
    for (const doc of filteredDocs) {
      const jid = doc.jobId || "";
      if (!jid) continue;
      if (!m.has(jid)) m.set(jid, []);
      m.get(jid)!.push(doc as CombinedDoc);
    }
    return m;
  }, [filteredDocs]);

  const unassignedDocs = useMemo(
    () => filteredDocs.filter((d) => !d.jobId || !jobs.some((j) => j.id === d.jobId)),
    [filteredDocs, jobs]
  );

  const renderDocRow = (doc: CombinedDoc, index: number) => {
    const config = docTypeConfig[doc.type] ?? {
      label: doc.type.replace(/-/g, " "),
      icon: FileText,
      color: "bg-muted text-muted-foreground",
    };
    const Icon = config.icon;
    const title =
      "displayTitle" in doc && doc.displayTitle ? doc.displayTitle : config.label;
    return (
      <motion.div
        key={doc.id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.03 }}
      >
        <Card className="hover:shadow-md transition-shadow border-border/80">
          <CardContent className="flex items-center gap-4 py-3">
            <div className={cn("p-2.5 rounded-xl shrink-0", config.color)}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate text-sm">{title}</p>
              <p className="text-xs text-muted-foreground">{config.label}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span className="truncate">{doc.clientName}</span>
                <span>•</span>
                <span className="font-mono">{doc.jobNumber}</span>
              </div>
            </div>
            <div className="text-right hidden sm:block shrink-0">
              <p className="text-xs text-muted-foreground">Generated</p>
              <p className="text-sm font-medium">
                {new Date(doc.generatedDate).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
            {doc.isApiDocument ? (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={async () => {
                  try {
                    await documentsService.downloadDocument(doc.id);
                  } catch {
                    toast.error("Download failed");
                  }
                }}
              >
                <Download className="h-4 w-4" />
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="shrink-0" asChild>
                <a href={doc.downloadUrl} download>
                  <Download className="h-4 w-4" />
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertDescription>Failed to load documents. Please try refreshing the page.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h2 className="text-2xl font-bold text-foreground">Compliance Documents</h2>
          <p className="text-muted-foreground">Open a job to view and download its documents</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-4"
      >
        <div className="relative flex-1 w-full min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by client or job number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-full"
          />
        </div>
        <div className="sm:hidden w-full">
          <Select value={activeFilter} onValueChange={setActiveFilter}>
            <SelectTrigger className="w-full">
              <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              {filters.map((filter) => (
                <SelectItem key={filter.value} value={filter.value}>
                  {filter.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="hidden sm:flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 -mx-1 px-1">
          {filters.map((filter) => (
            <Button
              key={filter.value}
              variant={activeFilter === filter.value ? "secondary" : "outline"}
              size="sm"
              onClick={() => setActiveFilter(filter.value)}
              className="whitespace-nowrap flex-shrink-0"
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </motion.div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(docTypeConfig).map(([type, config], index) => {
              const count = uniqueDocuments.filter((d) => d.type === type).length;
              const Icon = config.icon;
              const isActive = activeFilter === type;
              return (
                <motion.div
                  key={type}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.05 }}
                >
                  <Card
                    className={cn(
                      "cursor-pointer transition-all duration-200",
                      isActive
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background border-primary shadow-md scale-[1.02] bg-accent/60"
                        : "border-border hover:shadow-md hover:border-muted-foreground/20"
                    )}
                    onClick={() => setActiveFilter(type)}
                  >
                    <CardContent className="pt-4">
                      <div
                        className={cn(
                          "inline-flex p-2 rounded-lg mb-2 transition-colors",
                          config.color,
                          isActive && "ring-1 ring-primary/30"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <p className={cn("text-2xl font-bold", isActive && "text-foreground")}>{count}</p>
                      <p
                        className={cn(
                          "text-xs",
                          isActive ? "font-semibold text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {config.label}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              By job
            </h3>
            {jobsSorted.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No jobs loaded yet</div>
            ) : (
              jobsSorted.map((job) => {
                const docs = docsByJobId.get(job.id) ?? [];
                const open = openJobIds.has(job.id);
                return (
                  <Collapsible
                    key={job.id}
                    open={open}
                    onOpenChange={(nextOpen) => {
                      setOpenJobIds((prev) => {
                        const next = new Set(prev);
                        if (nextOpen) next.add(job.id);
                        else next.delete(job.id);
                        return next;
                      });
                    }}
                  >
                    <Card className="overflow-hidden">
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                            <Briefcase className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground truncate">
                              Job {job.erpJobNumber}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">
                              {job.organisationName}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                            {docs.length} doc{docs.length === 1 ? "" : "s"}
                          </span>
                          <ChevronDown
                            className={cn(
                              "h-5 w-5 text-muted-foreground transition-transform shrink-0",
                              open && "rotate-180"
                            )}
                          />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-4 pb-4 pt-0 space-y-2 border-t border-border/60 bg-muted/20">
                          {docs.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">
                              No documents match your filters for this job
                            </p>
                          ) : (
                            docs.map((doc, i) => renderDocRow(doc, i))
                          )}
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              })
            )}

            {unassignedDocs.length > 0 && (
              <div className="pt-4 space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Other
                </h3>
                <p className="text-xs text-muted-foreground mb-2">
                  Documents not linked to a listed job (or job no longer in your list)
                </p>
                {unassignedDocs.map((doc, i) => renderDocRow(doc as CombinedDoc, i))}
              </div>
            )}

            {filteredDocs.length === 0 && uniqueDocuments.length === 0 && (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No documents yet</p>
                <p className="text-sm text-muted-foreground">
                  Documents will appear here once jobs are processed
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Documents;
