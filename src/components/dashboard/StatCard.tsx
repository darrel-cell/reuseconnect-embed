import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "primary" | "success" | "accent";
  delay?: number;
}

const variantStyles = {
  default: {
    card: "bg-card",
    icon: "bg-secondary text-secondary-foreground",
  },
  primary: {
    card: "bg-gradient-eco border-primary/20",
    icon: "bg-primary/10 text-primary",
  },
  success: {
    card: "bg-success/5 border-success/20",
    icon: "bg-success/10 text-success",
  },
  accent: {
    card: "bg-accent/5 border-accent/30",
    icon: "bg-accent/15 text-accent-foreground",
  },
};

export function StatCard({ 
  title, 
  value, 
  subtitle,
  icon: Icon, 
  trend,
  variant = "default",
  delay = 0 
}: StatCardProps) {
  const styles = variantStyles[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={cn(
        "rounded-xl border p-5 shadow-sm transition-all duration-300 hover:shadow-md",
        styles.card
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {trend && (
              <span className={cn(
                "text-xs font-medium",
                trend.isPositive ? "text-success" : "text-destructive"
              )}>
                {trend.isPositive ? "+" : ""}{trend.value}%
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className={cn("p-3 rounded-xl", styles.icon)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  );
}
