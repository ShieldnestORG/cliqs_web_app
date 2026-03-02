/**
 * Get Started Page
 *
 * Interactive guided walkthroughs for every major flow in CLIQS.
 * Users select a journey, then walk through tab-based steps.
 */

import Head from "@/components/head";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChains } from "@/context/ChainsContext";
import { userJourneys, journeyCategories, type UserJourney } from "@/lib/userJourneys";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Lightbulb,
  Rocket,
  Signal,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

const difficultyConfig = {
  beginner: { label: "Beginner", color: "text-green-500 bg-green-500/10 border-green-500/20" },
  intermediate: {
    label: "Intermediate",
    color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  },
  advanced: { label: "Advanced", color: "text-red-400 bg-red-400/10 border-red-400/20" },
};

function JourneyCard({
  journey,
  onSelect,
}: {
  journey: UserJourney;
  onSelect: (j: UserJourney) => void;
}) {
  const Icon = journey.icon;
  const diff = difficultyConfig[journey.difficulty];

  return (
    <Card
      className="group cursor-pointer border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
      onClick={() => onSelect(journey)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect(journey)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary transition-colors group-hover:bg-primary/20">
            <Icon className="h-5 w-5" />
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
        </div>
        <CardTitle className="mt-3 text-base">{journey.title}</CardTitle>
        <CardDescription className="text-xs">{journey.subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">{journey.description}</p>
        <div className="flex items-center gap-3 text-xs">
          <span className={cn("rounded-full border px-2 py-0.5 font-medium", diff.color)}>
            {diff.label}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" />
            {journey.estimatedTime}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Signal className="h-3 w-3" />
            {journey.steps.length} steps
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function JourneyWalkthrough({
  journey,
  chainName,
  onBack,
}: {
  journey: UserJourney;
  chainName: string;
  onBack: () => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const Icon = journey.icon;
  const diff = difficultyConfig[journey.difficulty];
  const _step = journey.steps[currentStep];

  const markCompleted = useCallback((idx: number) => {
    setCompletedSteps((prev) => new Set(prev).add(idx));
  }, []);

  const goNext = useCallback(() => {
    markCompleted(currentStep);
    if (currentStep < journey.steps.length - 1) {
      setCurrentStep((s) => s + 1);
    }
  }, [currentStep, journey.steps.length, markCompleted]);

  const goPrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep]);

  const isLastStep = currentStep === journey.steps.length - 1;
  const allCompleted = completedSteps.size === journey.steps.length;
  const navigateHref = journey.navigateTo ? `/${chainName}${journey.navigateTo}` : undefined;

  return (
    <div className="space-y-6">
      {/* Journey Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="mt-1 shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{journey.title}</h1>
              <p className="text-sm text-muted-foreground">{journey.subtitle}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3 text-xs">
            <span className={cn("rounded-full border px-2 py-0.5 font-medium", diff.color)}>
              {diff.label}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              {journey.estimatedTime}
            </span>
          </div>
        </div>
      </div>

      {/* Prerequisites */}
      {journey.prerequisites.length > 0 && (
        <Card className="border-border bg-muted/30">
          <CardContent className="p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Before You Start
            </h3>
            <ul className="space-y-1.5">
              {journey.prerequisites.map((prereq, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-0.5 text-primary">•</span>
                  {prereq}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Step Tabs */}
      <Tabs value={String(currentStep)} onValueChange={(v) => setCurrentStep(Number(v))}>
        {/* Step Progress Bar */}
        <div className="relative">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted/50 p-1.5">
            {journey.steps.map((s, i) => {
              const isCompleted = completedSteps.has(i);
              const isCurrent = i === currentStep;

              return (
                <TabsTrigger
                  key={i}
                  value={String(i)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-xs transition-all data-[state=active]:shadow-sm",
                    isCompleted && !isCurrent && "text-primary",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors",
                      isCurrent
                        ? "bg-primary text-primary-foreground"
                        : isCompleted
                          ? "bg-primary/20 text-primary"
                          : "bg-muted-foreground/20 text-muted-foreground",
                    )}
                  >
                    {isCompleted ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
                  </span>
                  <span className="hidden max-w-[120px] truncate sm:inline">{s.title}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* Step Content */}
        {journey.steps.map((s, i) => (
          <TabsContent key={i} value={String(i)} className="mt-4">
            <Card className="border-border">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <div>
                    <CardTitle className="text-lg">{s.title}</CardTitle>
                    <CardDescription className="mt-1">{s.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Step Details */}
                <ul className="space-y-3">
                  {s.details.map((detail, j) => (
                    <li key={j} className="flex items-start gap-3 text-sm">
                      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-foreground/90">{detail}</span>
                    </li>
                  ))}
                </ul>

                {/* Tip */}
                {s.tip && (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-500">
                        Pro Tip
                      </p>
                      <p className="text-sm text-foreground/80">{s.tip}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={goPrev} disabled={currentStep === 0} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Previous
        </Button>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          Step {currentStep + 1} of {journey.steps.length}
          {completedSteps.size > 0 && (
            <span className="text-primary">({completedSteps.size} completed)</span>
          )}
        </div>

        {isLastStep ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                markCompleted(currentStep);
              }}
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Mark Complete
            </Button>
            {navigateHref && (
              <Link href={navigateHref}>
                <Button className="gap-2">
                  <Rocket className="h-4 w-4" />
                  Go Do It
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <Button onClick={goNext} className="gap-2">
            Next
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* All Completed Banner */}
      {allCompleted && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-primary/10 p-3">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Journey Complete!</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                You&apos;ve reviewed all steps.{" "}
                {navigateHref ? "Ready to get started for real?" : "You're all set!"}
              </p>
            </div>
            {navigateHref && (
              <Link href={navigateHref}>
                <Button size="lg" className="gap-2">
                  <Rocket className="h-5 w-5" />
                  Let&apos;s Go
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function GetStartedPage() {
  const { chain } = useChains();
  const router = useRouter();
  const [selectedJourney, setSelectedJourney] = useState<UserJourney | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Sync journey query param to selected journey
  const journeyParam = router.query.journey as string | undefined;
  useEffect(() => {
    if (!journeyParam) return;
    const found = userJourneys.find((j) => j.id === journeyParam);
    if (found) setSelectedJourney(found);
  }, [journeyParam]);

  const filteredJourneys =
    categoryFilter === "all"
      ? userJourneys
      : userJourneys.filter((j) => j.category === categoryFilter);

  return (
    <div className="container mx-auto max-w-[1600px] px-[0.75in] py-8">
      <Head title={`Get Started - ${chain.chainDisplayName || "CLIQS"}`} />

      <div className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={`/${chain.registryName || ""}`}>Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {selectedJourney ? (
                <BreadcrumbLink className="cursor-pointer" onClick={() => setSelectedJourney(null)}>
                  Get Started
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" />
                  Get Started
                </BreadcrumbPage>
              )}
            </BreadcrumbItem>
            {selectedJourney && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{selectedJourney.title}</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>

        {selectedJourney ? (
          <JourneyWalkthrough
            journey={selectedJourney}
            chainName={chain.registryName}
            onBack={() => setSelectedJourney(null)}
          />
        ) : (
          <>
            {/* Page Header */}
            <div className="space-y-2">
              <h1 className="flex items-center gap-3 font-heading text-3xl font-bold">
                <BookOpen className="h-8 w-8 text-primary" />
                Get Started
              </h1>
              <p className="max-w-2xl text-muted-foreground">
                Choose a guided walkthrough to learn how CLIQS works. Each journey takes you
                step-by-step through a specific flow — from creating your first multisig to managing
                your own database.
              </p>
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={categoryFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setCategoryFilter("all")}
                className="gap-2"
              >
                <Sparkles className="h-3.5 w-3.5" />
                All Journeys
              </Button>
              {journeyCategories.map((cat) => {
                const CatIcon = cat.icon;
                return (
                  <Button
                    key={cat.id}
                    variant={categoryFilter === cat.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCategoryFilter(cat.id)}
                    className="gap-2"
                  >
                    <CatIcon className="h-3.5 w-3.5" />
                    {cat.label}
                  </Button>
                );
              })}
            </div>

            {/* Journey Cards Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredJourneys.map((journey) => (
                <JourneyCard key={journey.id} journey={journey} onSelect={setSelectedJourney} />
              ))}
            </div>

            {filteredJourneys.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                <BookOpen className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p>No journeys found for this category.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
