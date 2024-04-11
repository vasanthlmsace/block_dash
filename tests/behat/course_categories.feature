@block @block_dash @dash_course_categories
Feature: Dash program to show the list of course categories data
  In order to show the course categories data source in dash block on the dashboard
  As an admin
  I can add the dash block to the dashboard

  Background:
    Given the following "categories" exist:
      | name       | category | idnumber |
      | Category 2 | 0        | CAT2     |
      | Category 3 | 0        | CAT3     |
      | Category 4 | CAT3     | CAT4     |
    And the following "courses" exist:
      | fullname | shortname | category | enablecompletion |
      | Course 1 | C1        | 0        | 1                |
      | Course 2 | C2        | CAT2     | 0                |
      | Course 3 | C3        | CAT3     | 1                |
      | Course 4 | C4        | CAT4     | 1                |
    And the following "users" exist:
      | username | firstname | lastname | email                |
      | student1 | Student   | First    | student1@example.com |
      | teacher1 | Teacher   | First    | teacher1@example.com |
      | student2 | Student   | Two      | student2@example.com |

    And the following "activities" exist:
      | activity | course | idnumber | section | name             | intro                 | completion | completionview |
      | page     | C1     | page1    | 0       | Test page name   | Test page description | 2          | 1              |
      | page     | C1     | page2    | 1       | Test page name 2 | Test page description | 2          | 1              |

    And the following "course enrolments" exist:
      | user     | course | role    |
      | student1 | C1     | student |
      | teacher1 | C1     | teacher |
      | student1 | C2     | student |
      | student1 | C3     | student |

    And I log in as "admin"
    And I navigate to "Plugins > Blocks > Dash" in site administration
    And I upload "blocks/dash/tests/assets/background.jpg" file to "Category fallback image" filemanager
    And I press "Save changes"
    And I navigate to "Appearance > Default Dashboard page" in site administration
    And I turn dash block editing mode on
    And I add the "Dash" block
    And I click on "Course categories" "radio"
    And I configure the "New Dash" block
    And I set the following fields to these values:
      | Block title  | Course Categories    |
      | Region       | content              |
      | Content      | My Course Categories |
    And I press "Save changes"
    And I click on "Reset Dashboard for all users" "button"
    And I log out

  @javascript @_file_upload
  Scenario: Display the Course categories data source
    Given I log in as "admin"
    And I navigate to "Plugins > Blocks > Dash" in site administration
    And I upload "blocks/dash/tests/assets/img-1.jpg" file to "Category 1" filemanager
    And I press "Save changes"
    And I navigate to "Appearance > Default Dashboard page" in site administration
    And I turn dash block editing mode on
    And I open the "Course Categories" block preference
    Then I click on "Fields" "link" in the "Edit preferences" "dialogue"
    And I click on "Select all" "button"
    And I press "Save changes"
    And I click on "Reset Dashboard for all users" "button"
    And I follow dashboard
    And I wait "10" seconds
    And I should see "Course 1" in the "Category 1" "table_row"
    And "Category 1" "link" should exist in the "Category 1" "table_row"
    And I should see "" in the "Category 1" "table_row"
    And the "src" attribute of ".dash-table a img" "css_element" should contain "img-1.jpg"
    And the "src" attribute of ".dash-table img" "css_element" should contain "img-1.jpg"
    Then "//td[contains(text(), 'img-1')]" "xpath_element" should exist in the "Category 1" "table_row"
    And I should see "1" in the "Course 1" "table_row"
    And I should see "Course 1" in the "Category 1" "table_row"

    # Course 2
    And I should see "Course 2" in the "Category 2" "table_row"
    And "Category 2" "link" should exist in the "Category 2" "table_row"
    And I should see "CAT2" in the "Category 2" "table_row"
    And "//div[contains(concat(' ', normalize-space(@class), ' '), 'text_to_html') and contains(text(), 'Test course category 1')]" "xpath_element" should exist
    And the "src" attribute of ".dash-table tr:nth-child(2) a img" "css_element" should contain "background"
    And the "src" attribute of ".dash-table tr:nth-child(2) img" "css_element" should contain "background"
    Then "//td[contains(text(), 'background')]" "xpath_element" should exist in the "Category 2" "table_row"
    And I should see "1" in the "Course 2" "table_row"
    And I should see "Course 2" in the "Category 2" "table_row"

    # Course 3
    And I should see "Course 3" in the "Category 3" "table_row"
    And "Category 3" "link" should exist in the "Category 3" "table_row"
    And I should see "CAT3" in the "Category 3" "table_row"
    And "//div[contains(concat(' ', normalize-space(@class), ' '), 'text_to_html') and contains(text(), 'Test course category 2')]" "xpath_element" should exist
    And the "src" attribute of ".dash-table tr:nth-child(3) a img" "css_element" should contain "background"
    And the "src" attribute of ".dash-table tr:nth-child(3) img" "css_element" should contain "background"
    Then "//td[contains(text(), 'background')]" "xpath_element" should exist in the "Category 3" "table_row"
    And I should see "1" in the "Course 3" "table_row"
    And I should see "Course 3" in the "Category 3" "table_row"

    # Course 4
    And I should see "Course 4" in the "Category 4" "table_row"
    And "Category 4" "link" should exist in the "Category 4" "table_row"
    And I should see "CAT4" in the "Category 4" "table_row"
    And "//div[contains(concat(' ', normalize-space(@class), ' '), 'text_to_html') and contains(text(), 'Test course category 2')]" "xpath_element" should exist
    And the "src" attribute of ".dash-table tr:nth-child(4) a img" "css_element" should contain "background"
    And the "src" attribute of ".dash-table tr:nth-child(4) img" "css_element" should contain "background"
    Then "//td[contains(text(), 'background')]" "xpath_element" should exist in the "Category 4" "table_row"
    And I should see "1" in the "Course 4" "table_row"
    And I should see "Course 4" in the "Category 4" "table_row"

  @javascript @_file_upload
  Scenario: Display the Course categories with filter conditions
    And I log in as "admin"
    And I navigate to "Appearance > Default Dashboard page" in site administration
    And I turn dash block editing mode on
    And I open the "Course Categories" block preference
    Then I click on "Fields" "link" in the "Edit preferences" "dialogue"
    And I click on "Select all" "button"
    Then I click on "Conditions" "link" in the "Edit preferences" "dialogue"
    And I click on "Course categories" "checkbox"
    And I set the field "id_config_preferences_filters_c_course_categories_condition_coursecategories" to "Category 3"
    And I press "Save changes"
    And I click on "Reset Dashboard for all users" "button"
    And I follow dashboard

    # Course 3
    And I should see "Course 3" in the "Category 3" "table_row"
    And "Category 3" "link" should exist in the "Category 3" "table_row"
    And I should see "CAT3" in the "Category 3" "table_row"
    And "//div[contains(concat(' ', normalize-space(@class), ' '), 'text_to_html') and contains(text(), 'Test course category 2')]" "xpath_element" should exist
    And the "src" attribute of ".dash-table tr a img" "css_element" should contain "background"
    And the "src" attribute of ".dash-table tr img" "css_element" should contain "background"
    Then "//td[contains(text(), 'background')]" "xpath_element" should exist in the "Category 3" "table_row"
    And I should see "1" in the "Course 3" "table_row"
    And I should see "Course 3" in the "Category 3" "table_row"
    And "Category 4" "table_row" should not exist

    And I navigate to "Appearance > Default Dashboard page" in site administration
    And I turn dash block editing mode on
    And I open the "Course Categories" block preference
    Then I click on "Conditions" "link" in the "Edit preferences" "dialogue"
    And I click on "Include subcategories" "checkbox"
    And I press "Save changes"
    And I click on "Reset Dashboard for all users" "button"
    And I follow dashboard

    # Course 4
    And I should see "Course 3" in the "Category 3" "table_row"
    And I should see "Course 4" in the "Category 4" "table_row"
    And "Category 4" "link" should exist in the "Category 4" "table_row"
    And I should see "CAT4" in the "Category 4" "table_row"
    And "//div[contains(concat(' ', normalize-space(@class), ' '), 'text_to_html') and contains(text(), 'Test course category 2')]" "xpath_element" should exist
    And the "src" attribute of ".dash-table tr:nth-child(2) a img" "css_element" should contain "background"
    And the "src" attribute of ".dash-table tr:nth-child(2) img" "css_element" should contain "background"
    Then "//td[contains(text(), 'background')]" "xpath_element" should exist in the "Category 4" "table_row"
    And I should see "1" in the "Course 4" "table_row"
    And I should see "Course 4" in the "Category 4" "table_row"

    And I wait "10" seconds