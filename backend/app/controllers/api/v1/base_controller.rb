module Api
  module V1
    # Base for authenticated JSON API controllers (architecture §5, BACKEND_PLAN.md H1, L9).
    # Inherits ActionController::Base directly (not ApplicationController) so HTML-only behaviour such as
    # allow_browser never applies; the full-stack app already provides cookies, sessions, and CSRF protection.
    class BaseController < ActionController::Base
      include Api::ErrorHandling
      include Api::Authentication
      include Api::Pagination # includes Api::QueryParams

      protect_from_forgery with: :exception
      prepend_before_action :force_json_format

      # Request bodies must use the documented resource key (e.g. "employee"); no automatic wrapping.
      wrap_parameters false

      # Actions that may answer .csv (BACKEND_PLAN.md M14); every other request is forced to JSON.
      class_attribute :csv_actions, instance_accessor: false, default: [].freeze

      def self.allow_csv(*actions)
        self.csv_actions = actions.map(&:to_s).freeze
      end

      private

      def force_json_format
        return if request.format.csv? && self.class.csv_actions.include?(action_name)

        request.format = :json
      end
    end
  end
end
