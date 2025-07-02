import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  currentPrice?: number;
}

export default function AlertModal({ isOpen, onClose, symbol, currentPrice }: AlertModalProps) {
  const [alertPrice, setAlertPrice] = useState("");
  const [alertType, setAlertType] = useState<"above" | "below">("above");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createAlertMutation = useMutation({
    mutationFn: async (data: { symbol: string; targetPrice: number; alertType: string }) => {
      const response = await apiRequest("POST", "/api/alerts", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Alert Created",
        description: `Price alert for ${symbol} has been created successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      queryClient.invalidateQueries({ queryKey: [`/api/alerts/${symbol}`] });
      handleClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create alert. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(alertPrice);
    if (isNaN(price) || price <= 0) {
      toast({
        title: "Invalid Price",
        description: "Please enter a valid price.",
        variant: "destructive",
      });
      return;
    }

    createAlertMutation.mutate({
      symbol,
      targetPrice: price,
      alertType,
    });
  };

  const handleClose = () => {
    setAlertPrice("");
    setAlertType("above");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Price Alert</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="alert-price">Alert Price</Label>
            <Input
              id="alert-price"
              type="number"
              step="0.01"
              placeholder={currentPrice?.toFixed(2) || "0.00"}
              value={alertPrice}
              onChange={(e) => setAlertPrice(e.target.value)}
              className="bg-background border-border"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="alert-type">Alert Type</Label>
            <Select value={alertType} onValueChange={(value: "above" | "below") => setAlertType(value)}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="above">Price Above</SelectItem>
                <SelectItem value="below">Price Below</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={createAlertMutation.isPending}
            >
              {createAlertMutation.isPending ? "Creating..." : "Create Alert"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
