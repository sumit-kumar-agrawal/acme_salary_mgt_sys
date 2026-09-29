import { Route, Routes } from "react-router";
import SignInPage from "@/components/auth/SignInPage";
import NotFoundPage from "@/components/common/NotFoundPage";
import AnalyticsPage from "@/components/dashboard/AnalyticsPage";
import DashboardPage from "@/components/dashboard/DashboardPage";
import EmployeeCreatePage from "@/components/employees/EmployeeCreatePage";
import EmployeeDetailPage from "@/components/employees/EmployeeDetailPage";
import EmployeeEditPage from "@/components/employees/EmployeeEditPage";
import EmployeeListPage from "@/components/employees/EmployeeListPage";
import SalaryReportPage from "@/components/reports/SalaryReportPage";
import MainLayout from "@/layouts/MainLayout";
import RequireAuth from "@/routes/RequireAuth";
import { SIGN_IN_PATH } from "@/routes/returnPath";

// Application routes (FRONTEND_PLAN.md F1.1, R9). Pages are added here as their features are built.
export default function AppRoutes() {
  return (
    <Routes>
      <Route path={SIGN_IN_PATH} element={<SignInPage />} />
      <Route
        element={
          <RequireAuth>
            <MainLayout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="employees" element={<EmployeeListPage />} />
        <Route path="employees/new" element={<EmployeeCreatePage />} />
        <Route path="employees/:id" element={<EmployeeDetailPage />} />
        <Route path="employees/:id/edit" element={<EmployeeEditPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="reports/salaries" element={<SalaryReportPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
