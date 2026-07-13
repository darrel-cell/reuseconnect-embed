import { motion } from "framer-motion";
import { Package, UserPlus, ArrowRight, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface BookingTypeSelectorProps {
  onSelect: (type: 'itad' | 'jml' | 'courier_collection') => void;
}

export function BookingTypeSelector({ onSelect }: BookingTypeSelectorProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Create New Booking</h1>
        <p className="text-muted-foreground">
          Choose the type of booking you want to create
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3 max-w-6xl mx-auto">
        {/* ITAD Collection Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow h-full"
            onClick={() => onSelect('itad')}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Package className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <CardTitle>ITAD Collection</CardTitle>
                  <CardDescription>
                    IT Asset Disposition
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Book a collection for IT assets that need to be disposed of, sanitized, and graded.
                Includes CO2 calculations and buyback estimates.
              </p>
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Asset collection and disposal
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Data sanitization
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Asset grading and valuation
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  CO2 impact tracking
                </li>
              </ul>
              <Button className="w-full mt-4" onClick={() => onSelect('itad')}>
                Select ITAD Collection
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Free Courier Collection Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
        >
          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow h-full"
            onClick={() => onSelect('courier_collection')}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/10 rounded-lg">
                  <Truck className="h-8 w-8 text-emerald-600" />
                </div>
                <div>
                  <CardTitle>Free Courier Collection</CardTitle>
                  <CardDescription>
                    Small Box Collection
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                For small bookings where Reuse sends one courier box for collection.
                Available for phones and laptops only.
              </p>
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Max 5 items in total
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  One box up to 30kg
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Phones and laptops only
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Admin books courier and tracking
                </li>
              </ul>
              <Button
                className="w-full mt-4"
                variant="outline"
                onClick={() => onSelect('courier_collection')}
              >
                Select Free Courier
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* JML Booking Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow h-full"
            onClick={() => onSelect('jml')}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <UserPlus className="h-8 w-8 text-blue-500" />
                </div>
                <div>
                  <CardTitle>JML Booking</CardTitle>
                  <CardDescription>
                    Joiners, Leavers, Movers
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Manage employee device lifecycle: new starter equipment allocation, leaver device collection, 
                and breakfix replacements.
              </p>
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  New starter device allocation
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Leaver device collection
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Breakfix replacements
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Inventory management
                </li>
              </ul>
              <Button 
                className="w-full mt-4" 
                variant="outline"
                onClick={() => onSelect('jml')}
              >
                Select JML Booking
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
