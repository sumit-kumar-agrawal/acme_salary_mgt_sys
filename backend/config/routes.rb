Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api, defaults: { format: :json } do
    namespace :v1 do
      # Public health check including a database probe (docs/api-specification.md §3).
      get "health", to: "health#show"

      # Sign in / state / sign out for the single HR user (docs/api-specification.md §4).
      resource :session, only: %i[show create destroy]

      # Read-only reference data for filters and forms (docs/api-specification.md §5).
      resources :countries, only: :index
      resources :departments, only: :index
      resources :currencies, only: :index

      # No destroy: employees are terminated, never deleted (docs/api-specification.md §6, I12).
      resources :employees, only: %i[index show create update] do
        # History, salary change (POST), and correction (PATCH); no destroy (docs/api-specification.md §7, I12).
        resources :salary_records, only: %i[index show create update]
      end

      # Bulk salary correction from a CSV/XLSX upload, its history, and its files (Api::BulkUploadable).
      resources :bulk_salary_corrections, only: %i[index show create] do
        get :template, on: :collection
        member do
          get :original_file
          get :failed_rows_file
        end
      end

      # Read-only, per-currency compensation analytics (docs/api-specification.md §8, BACKEND_PLAN.md M7).
      namespace :analytics do
        resource :summary, only: :show
        resource :distribution, only: :show
        resource :breakdown, only: :show
      end

      # Record-level salary report sharing the analytics filters (docs/api-specification.md §9).
      # JSON or CSV only (5.3); any other extension falls through to the JSON 404 catch-all.
      namespace :reports do
        resources :salaries, only: :index, constraints: { format: /json|csv/ }
      end

      # Must stay last: any other /api/v1 path returns a JSON 404, never HTML (BACKEND_PLAN.md L10).
      match "(*path)", to: "not_found#show", via: :all
    end
  end

  # Render dynamic PWA files from app/views/pwa/* (remember to link manifest in application.html.erb)
  # get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
  # get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker

  # Public landing page with a high-level description of the service (no employee or salary data).
  root "home#show"
end
