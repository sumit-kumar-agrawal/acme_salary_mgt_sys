import { demoEmployeeId, expect, test } from "./support.ts";

// Responsive check (FRONTEND_PLAN.md X7): no page scrolls sideways at phone, tablet, or desktop width.
// Wide tables may scroll inside their own wrappers; the page itself must not. Read-only.

const WIDTHS = [390, 768, 1280] as const;

const PAGES = [
  { name: "dashboard", path: () => "/", ready: "Employees by department" },
  { name: "employee list", path: () => "/employees", ready: "Employees" },
  {
    name: "employee detail",
    path: (id: number) => `/employees/${id}`,
    ready: "Salary history",
  },
  {
    name: "analytics",
    path: () => "/analytics",
    ready: "Breakdown by country",
  },
  {
    name: "salary report",
    path: () => "/reports/salaries",
    ready: "Salary report",
  },
] as const;

for (const width of WIDTHS) {
  test(`no page scrolls sideways at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const id = await demoEmployeeId(page);

    const overflow: Record<string, number> = {};
    for (const target of PAGES) {
      await page.goto(target.path(id));
      await expect(
        page.getByRole("table", { name: target.ready }),
      ).toBeVisible();
      overflow[target.name] = await page.evaluate<number>(
        "document.documentElement.scrollWidth - document.documentElement.clientWidth",
      );
    }
    expect(overflow).toEqual(
      Object.fromEntries(PAGES.map((target) => [target.name, 0])),
    );
  });
}

// Found at 768 px in F8.2: dates in the employee list and the report broke across two lines ("2012-05-" / "08").
test("dates in table cells stay on one line at tablet width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 900 });
  for (const [path, table, column] of [
    ["/employees", "Employees", "Hired on"],
    ["/reports/salaries", "Salary report", "Effective from"],
  ] as const) {
    await page.goto(path);
    const grid = page.getByRole("table", { name: table });
    await expect(grid).toBeVisible();
    const headers = await grid.getByRole("columnheader").allTextContents();
    const index = headers.findIndex((header) => header.startsWith(column));
    expect(index).toBeGreaterThanOrEqual(0);
    const cell = grid.locator(
      `tbody tr:first-child td:nth-child(${index + 1})`,
    );
    // A date cell never wraps, so "2012-05-08" stays on one line however narrow the column gets.
    await expect(cell, `${table}: ${column}`).toHaveCSS(
      "white-space",
      "nowrap",
    );
  }
});
