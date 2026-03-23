"use client";

import type { WalletBalance } from "@/types";
import { formatCrypto, formatUsd, cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

interface BalanceTableProps {
  balances: WalletBalance[];
  onDeposit?: (asset: string) => void;
  onWithdraw?: (asset: string) => void;
}

export function BalanceTable({
  balances,
  onDeposit,
  onWithdraw,
}: BalanceTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-text-tertiary border-b border-border">
            <th className="text-left px-4 py-3 font-medium">Asset</th>
            <th className="text-right px-4 py-3 font-medium">Available</th>
            <th className="text-right px-4 py-3 font-medium">Locked</th>
            <th className="text-right px-4 py-3 font-medium">Total</th>
            <th className="text-right px-4 py-3 font-medium">USD Value</th>
            <th className="text-right px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {balances.map((balance) => (
            <tr
              key={balance.asset}
              className="border-b border-border/50 hover:bg-dark-700/30 transition-colors"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-dark-600 flex items-center justify-center text-xs font-bold text-novex-primary">
                    {balance.asset.slice(0, 2)}
                  </div>
                  <div>
                    <div className="font-semibold text-text-primary">
                      {balance.asset}
                    </div>
                    <div className="text-xs text-text-tertiary">
                      {balance.name}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-right font-mono text-text-primary">
                {formatCrypto(balance.available, 6)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-text-tertiary">
                {formatCrypto(balance.locked, 6)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-text-primary font-medium">
                {formatCrypto(balance.total, 6)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-text-secondary">
                {formatUsd(balance.usdValue)}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeposit?.(balance.asset)}
                  >
                    <ArrowDownToLine size={14} />
                    Deposit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onWithdraw?.(balance.asset)}
                  >
                    <ArrowUpFromLine size={14} />
                    Withdraw
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
