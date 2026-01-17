import { useState } from "react";
import { X, ExternalLink, TrendingUp, TrendingDown, Minus, Newspaper } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NewsSource {
    title: string;
    url: string;
    date: string;
    snippet: string;
    publisher: string;
}

interface NewsAnalysis {
    prediction: "rising" | "falling" | "stable";
    confidence: number;
    summary: string;
    reasoning: string;
    sources: NewsSource[];
    last_updated: string;
}

interface Props {
    analysis: NewsAnalysis | null;
    isOpen: boolean;
    onClose: () => void;
}

export function NewsInsightsModal({ analysis, isOpen, onClose }: Props) {
    if (!analysis) return null;

    const getTrendIcon = () => {
        switch (analysis.prediction) {
            case "rising":
                return <TrendingUp className="h-6 w-6 text-red-500" />;
            case "falling":
                return <TrendingDown className="h-6 w-6 text-green-500" />;
            default:
                return <Minus className="h-6 w-6 text-muted-foreground" />;
        }
    };

    const getTrendColor = () => {
        switch (analysis.prediction) {
            case "rising":
                return "text-red-500";
            case "falling":
                return "text-green-500";
            default:
                return "text-muted-foreground";
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[80vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Newspaper className="h-5 w-5" />
                        AI Market Analysis
                    </DialogTitle>
                </DialogHeader>

                <ScrollArea className="max-h-[60vh] pr-4">
                    <div className="space-y-6">
                        {/* Prediction Summary */}
                        <div className="bg-muted/50 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    {getTrendIcon()}
                                    <span className={`text-2xl font-bold capitalize ${getTrendColor()}`}>
                                        Prices {analysis.prediction}
                                    </span>
                                </div>
                                <Badge variant="outline">
                                    {Math.round(analysis.confidence * 100)}% confidence
                                </Badge>
                            </div>
                            <p className="text-muted-foreground">{analysis.summary}</p>
                        </div>

                        {/* Detailed Reasoning */}
                        <div>
                            <h4 className="font-semibold mb-2 flex items-center gap-2">
                                AI Analysis
                            </h4>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {analysis.reasoning}
                            </p>
                        </div>

                        {/* News Sources */}
                        <div>
                            <h4 className="font-semibold mb-3 flex items-center gap-2">
                                📰 Sources ({analysis.sources.length} articles)
                            </h4>
                            <div className="space-y-3">
                                {analysis.sources.map((source, index) => (
                                    <div
                                        key={index}
                                        className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1">
                                                <a
                                                    href={source.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="font-medium text-primary hover:underline inline-flex items-center gap-1"
                                                >
                                                    {source.title}
                                                    <ExternalLink className="h-3 w-3" />
                                                </a>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Badge variant="secondary" className="text-xs">
                                                        {source.publisher}
                                                    </Badge>
                                                    <span className="text-xs text-muted-foreground">
                                                        {source.date}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                                            {source.snippet}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Disclaimer */}
                        <div className="text-xs text-muted-foreground border-t pt-4">
                            <p>
                                ⚠️ <strong>Disclaimer:</strong> This analysis is generated using AI and
                                should not be considered financial advice. Actual prices may vary based on
                                local market conditions, taxes, and other factors.
                            </p>
                            <p className="mt-1">
                                Last updated: {new Date(analysis.last_updated).toLocaleString()}
                            </p>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}

export type { NewsAnalysis, NewsSource };
