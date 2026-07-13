import { motion } from "framer-motion";
import { UserPlus, UserMinus, Wrench, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface JMLSubTypeSelectorProps {
  onSelect: (subType: 'new_starter' | 'leaver' | 'breakfix' | 'mover') => void;
  onBack: () => void;
}

export function JMLSubTypeSelector({ onSelect, onBack }: JMLSubTypeSelectorProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">JML Booking Type</h1>
        <p className="text-muted-foreground">
          Select the type of JML booking you want to create
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 max-w-5xl mx-auto">
        {/* New Starter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow h-full"
            onClick={() => onSelect('new_starter')}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <UserPlus className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <CardTitle>New Starter</CardTitle>
                  <CardDescription>
                    Allocate device for new employee
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Set up equipment for a new employee. Requires minimum 5 working days notice.
              </p>
              <Button className="w-full" onClick={() => onSelect('new_starter')}>
                Select New Starter
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Leaver */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
        >
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow h-full"
            onClick={() => onSelect('leaver')}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-500/10 rounded-lg">
                  <UserMinus className="h-6 w-6 text-red-500" />
                </div>
                <div>
                  <CardTitle>Leaver</CardTitle>
                  <CardDescription>
                    Collect device from departing employee
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Schedule collection of equipment from an employee who is leaving.
              </p>
              <Button className="w-full" onClick={() => onSelect('leaver')}>
                Select Leaver
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Breakfix */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.2 }}
        >
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow h-full"
            onClick={() => onSelect('breakfix')}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-500/10 rounded-lg">
                  <Wrench className="h-6 w-6 text-orange-500" />
                </div>
                <div>
                  <CardTitle>Breakfix</CardTitle>
                  <CardDescription>
                    Replace broken device
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Replace a broken device with a new one and collect the broken device.
              </p>
              <Button className="w-full" onClick={() => onSelect('breakfix')}>
                Select Breakfix
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Mover */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.3 }}
        >
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow h-full"
            onClick={() => onSelect('mover')}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <UserPlus className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <CardTitle>Mover</CardTitle>
                  <CardDescription>
                    Employee department change
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Handle device transfer when an employee moves to a different department.
                Uses the same workflow as breakfix.
              </p>
              <Button className="w-full" onClick={() => onSelect('mover')}>
                Select Mover
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="flex justify-center">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>
    </div>
  );
}
