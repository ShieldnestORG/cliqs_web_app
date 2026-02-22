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
import {
  userJourneys,
  journeyCategories,
  type UserJourney,
} from "@/lib/userJourneys";
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
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";

const difficultyConfig = {
  beginner: { label: "Beginner", color: "text-green-500 bg-green-500/10 border-green-500/20" },
  intermediate: { label: "Intermediate", color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
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
      className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-primary/40 hover:-translate-y-0.5 bg-card border-border"
      onClick={() => onSelect(journey)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect(journey)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
            <Icon className="h-5 w-5" />
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-0.5" />
        </div>
        <CardTitle className="text-base mt-3">{journey.title}</CardTitle>
        <CardDescription className="text-xs">{journey.subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
          {journey.description}
        </p>
        <div className="flex items-center gap-3 text-xs">
          <span className={cn("px-2 py-0.5 rounded-full border font-medium", diff.color)}>
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
  const step = journey.steps[currentStep];

  const markCompleted = useCallback(
    (idx: number) => {
      setCompletedSteps((prev) => new Set(prev).add(idx));
    },
    [],
  );

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
  const navigateHref = journey.navigateTo
    ? `/${chainName}${journey.navigateTo}`
    : undefined;

  return (
    <div className="space-y-6">
      {/* Journey Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="mt-1 shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{journey.title}</h1>
              <p className="text-sm text-muted-foreground">{journey.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs mt-3">
            <span className={cn("px-2 py-0.5 rounded-full border font-medium", diff.color)}>
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
        <Card className="bg-muted/30 border-border">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Before You Start
            </h3>
            <ul className="space-y-1.5">
              {journey.prerequisites.map((prereq, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  {prereq}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Step Tabs */}
      <Tabs
        value={String(currentStep)}
        onValueChange={(v) => setCurrentStep(Number(v))}
      >
        {/* Step Progress Bar */}
        <div className="relative">
          <TabsList className="w-full h-auto p-1.5 bg-muted/50 flex-wrap gap-1 justify-start">
            {journey.steps.map((s, i) => {
              const isCompleted = completedSteps.has(i);
              const isCurrent = i === currentStep;

              return (
                <TabsTrigger
                  key={i}
                  value={String(i)}
                  className={cn(
                    "flex items-center gap-2 text-xs px-3 py-2 transition-all data-[state=active]:shadow-sm",
                    isCompleted && !isCurrent && "text-primary",
                  )}
                >
                  <span
                    className={cn(
                      "flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0 transition-colors",
                      isCurrent
                        ? "bg-primary text-primary-foreground"
                        : isCompleted
                          ? "bg-primary/20 text-primary"
                          : "bg-muted-foreground/20 text-muted-foreground",
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className="hidden sm:inline truncate max-w-[120px]">{s.title}</span>
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
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
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
                      <ArrowRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span className="text-foreground/90">{detail}</span>
                    </li>
                  ))}
                </ul>

                {/* Tip */}
                {s.tip && (
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                    <Lightbulb className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider mb-1">
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
        <Button
          variant="outline"
          onClick={goPrev}
          disabled={currentStep === 0}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous
        </Button>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          Step {currentStep + 1} of {journey.steps.length}
          {completedSteps.size > 0 && (
            <span className="text-primary">
              ({completedSteps.size} completed)
            </span>
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
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Journey Complete!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                You&apos;ve reviewed all steps.{" "}
                {navigateHref
                  ? "Ready to get started for real?"
                  : "You're all set!"}
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

  // Check for journey query param
  const journeyParam = router.query.journey as string | undefined;
  if (journeyParam && !selectedJourney) {
    const found = userJourneys.find((j) => j.id === journeyParam);
    if (found) {
      setSelectedJourney(found);
    }
  }

  const filteredJourneys =
    categoryFilter === "all"
      ? userJourneys
      : userJourneys.filter((j) => j.category === categoryFilter);

  return (
    <div className="container mx-auto px-[0.75in] py-8 max-w-[1600px]">
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
                <BreadcrumbLink
                  className="cursor-pointer"
                  onClick={() => setSelectedJourney(null)}
                >
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
              <h1 className="text-3xl font-heading font-bold flex items-center gap-3">
                <BookOpen className="h-8 w-8 text-primary" />
                Get Started
              </h1>
              <p className="text-muted-foreground max-w-2xl">
                Choose a guided walkthrough to learn how CLIQS works. Each journey takes you
                step-by-step through a specific flow — from creating your first multisig to
                managing your own database.
              </p>
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2 flex-wrap">
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
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredJourneys.map((journey) => (
                <JourneyCard
                  key={journey.id}
                  journey={journey}
                  onSelect={setSelectedJourney}
                />
              ))}
            </div>

            {filteredJourneys.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No journeys found for this category.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
