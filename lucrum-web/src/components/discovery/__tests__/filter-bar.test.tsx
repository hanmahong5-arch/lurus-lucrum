/**
 * Filter Bar Tests
 *
 * Story 3.2: Discovery Page & Filter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { FilterBar } from "../filter-bar";
import type { DiscoveryFilters } from "@/hooks/use-discovery-strategies";

// =============================================================================
// SETUP
// =============================================================================

const defaultFilters: DiscoveryFilters = {
  type: "all",
  sort: "popularity",
  search: "",
};

describe("FilterBar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders type select, sort select, and search input", () => {
    const onFiltersChange = vi.fn();

    render(
      <FilterBar
        filters={defaultFilters}
        onFiltersChange={onFiltersChange}
        totalCount={42}
      />
    );

    expect(screen.getByTestId("filter-type-select")).toBeInTheDocument();
    expect(screen.getByTestId("filter-sort-select")).toBeInTheDocument();
    expect(screen.getByTestId("filter-search-input")).toBeInTheDocument();
  });

  it("displays total count", () => {
    const onFiltersChange = vi.fn();

    render(
      <FilterBar
        filters={defaultFilters}
        onFiltersChange={onFiltersChange}
        totalCount={42}
      />
    );

    expect(screen.getByTestId("filter-total-count")).toHaveTextContent("42");
  });

  it("triggers onFiltersChange when type changes", () => {
    const onFiltersChange = vi.fn();

    render(
      <FilterBar
        filters={defaultFilters}
        onFiltersChange={onFiltersChange}
        totalCount={10}
      />
    );

    fireEvent.change(screen.getByTestId("filter-type-select"), {
      target: { value: "trend" },
    });

    expect(onFiltersChange).toHaveBeenCalledWith({
      ...defaultFilters,
      type: "trend",
    });
  });

  it("triggers onFiltersChange when sort changes", () => {
    const onFiltersChange = vi.fn();

    render(
      <FilterBar
        filters={defaultFilters}
        onFiltersChange={onFiltersChange}
        totalCount={10}
      />
    );

    fireEvent.change(screen.getByTestId("filter-sort-select"), {
      target: { value: "latest" },
    });

    expect(onFiltersChange).toHaveBeenCalledWith({
      ...defaultFilters,
      sort: "latest",
    });
  });

  it("debounces search input at 300ms", () => {
    const onFiltersChange = vi.fn();

    render(
      <FilterBar
        filters={defaultFilters}
        onFiltersChange={onFiltersChange}
        totalCount={10}
      />
    );

    const searchInput = screen.getByTestId("filter-search-input");
    fireEvent.change(searchInput, { target: { value: "MACD" } });

    // Should not fire immediately
    expect(onFiltersChange).not.toHaveBeenCalled();

    // Advance timer by 300ms
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onFiltersChange).toHaveBeenCalledWith({
      ...defaultFilters,
      search: "MACD",
    });
  });

  it("cancels previous debounce when typing continues", () => {
    const onFiltersChange = vi.fn();

    render(
      <FilterBar
        filters={defaultFilters}
        onFiltersChange={onFiltersChange}
        totalCount={10}
      />
    );

    const searchInput = screen.getByTestId("filter-search-input");

    // Type first value
    fireEvent.change(searchInput, { target: { value: "MA" } });

    // Wait 200ms (not enough for debounce)
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Type second value before debounce fires
    fireEvent.change(searchInput, { target: { value: "MACD" } });

    // Wait 300ms for second debounce
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Should only have been called once with final value
    expect(onFiltersChange).toHaveBeenCalledTimes(1);
    expect(onFiltersChange).toHaveBeenCalledWith({
      ...defaultFilters,
      search: "MACD",
    });
  });

  it("has correct ARIA attributes", () => {
    const onFiltersChange = vi.fn();

    render(
      <FilterBar
        filters={defaultFilters}
        onFiltersChange={onFiltersChange}
        totalCount={10}
      />
    );

    expect(screen.getByTestId("filter-bar")).toHaveAttribute("role", "toolbar");
    expect(screen.getByTestId("filter-type-select")).toHaveAttribute("aria-label");
    expect(screen.getByTestId("filter-sort-select")).toHaveAttribute("aria-label");
    expect(screen.getByTestId("filter-search-input")).toHaveAttribute("aria-label");
  });

  it("shows filter options including all types", () => {
    const onFiltersChange = vi.fn();

    render(
      <FilterBar
        filters={defaultFilters}
        onFiltersChange={onFiltersChange}
        totalCount={10}
      />
    );

    const typeSelect = screen.getByTestId("filter-type-select");
    const options = typeSelect.querySelectorAll("option");

    // Should have all, trend, mean-revert, momentum, composite
    expect(options.length).toBeGreaterThanOrEqual(5);
  });
});