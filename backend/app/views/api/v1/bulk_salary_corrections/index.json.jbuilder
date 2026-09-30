json.data @bulk_imports, partial: "api/v1/bulk_salary_corrections/bulk_import", as: :bulk_import
json.meta { json.partial! "api/v1/shared/pagination_meta", meta: @pagination_meta }
