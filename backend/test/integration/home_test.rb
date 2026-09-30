require "test_helper"

# GET /: public landing page (HomeController).
class HomeTest < ActionDispatch::IntegrationTest
  MODERN_BROWSER = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) " \
                   "Chrome/130.0.0.0 Safari/537.36".freeze

  test "the root page is public HTML with a high-level description and no salary data" do
    employee = create(:employee, first_name: "Zelda")
    create(:salary_record, employee: employee, amount: "123456")

    get root_path, headers: { "User-Agent" => MODERN_BROWSER }

    assert_response :ok
    assert_equal "text/html", response.media_type
    assert_select "title", "Acme Salary Management"
    assert_select "h1", "Salary Management System"
    assert_select "a[href=?]", api_v1_health_path
    assert_no_match(/Zelda|123456|#{employee.employee_number}/, response.body)
  end
end
