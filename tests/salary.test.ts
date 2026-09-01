import { expect, test } from "vitest";
import { formatSalary } from "@/lib/salary";

test("formatSalary hides zero ranges as undisclosed", () => {
  expect(
    formatSalary({
      salaryRaw: "0–0",
      salaryMin: 0,
      salaryMax: 0,
      salaryCurrency: "USD",
    }),
  ).toBe("undisclosed");
  expect(
    formatSalary({
      salaryRaw: null,
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
    }),
  ).toBe("undisclosed");
});

test("formatSalary keeps a real range", () => {
  expect(
    formatSalary({
      salaryRaw: "90–140",
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
    }),
  ).toBe("90–140");
  expect(
    formatSalary({
      salaryRaw: null,
      salaryMin: 120000,
      salaryMax: 160000,
      salaryCurrency: "USD",
    }),
  ).toBe("120000–160000 USD");
});
