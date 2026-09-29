import { Route, Routes } from "react-router";
import SignInPage from "@/components/auth/SignInPage";
import NotFoundPage from "@/components/common/NotFoundPage";
import HomePage from "@/components/dashboard/HomePage";
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
        <Route index element={<HomePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
