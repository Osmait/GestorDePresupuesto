//go:build e2e
// +build e2e

package e2e

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

type notificationItem struct {
	ID        string    `json:"id"`
	Type      string    `json:"type"`
	Message   string    `json:"message"`
	CreatedAt time.Time `json:"created_at"`
}

type notificationPage struct {
	Items      []notificationItem `json:"items"`
	NextCursor *string            `json:"next_cursor"`
}

// TestNotificationHistoryPagination covers the GET /notifications/history
// contract: legacy array without parameters, keyset pages newest first with
// limit/cursor, 400 on invalid input.
func (suite *E2ETestSuite) TestNotificationHistoryPagination() {
	flow := suite.helpers.CreateUserFlow("notifpages")
	token := flow.Token

	const total = 7
	for range total {
		resp := suite.helpers.MakeRequest("POST", "/notifications/test", nil, token)
		suite.Require().Equal(http.StatusOK, resp.StatusCode, resp.AsString())
	}

	// Legacy shape: the whole history as an array, newest first.
	resp := suite.helpers.MakeRequest("GET", "/notifications/history", nil, token)
	suite.Require().Equal(http.StatusOK, resp.StatusCode)
	var legacy []notificationItem
	suite.Require().NoError(resp.AsJSON(&legacy))
	suite.Require().Len(legacy, total)
	for i := 1; i < len(legacy); i++ {
		suite.False(legacy[i].CreatedAt.After(legacy[i-1].CreatedAt), "legacy history must be newest first")
	}

	// Paginated: limit=3 → 3 + 3 + 1, same order as the legacy list.
	var walked []notificationItem
	cursor := ""
	pages := 0
	for {
		path := "/notifications/history?limit=3"
		if cursor != "" {
			path += "&cursor=" + url.QueryEscape(cursor)
		}
		resp := suite.helpers.MakeRequest("GET", path, nil, token)
		suite.Require().Equal(http.StatusOK, resp.StatusCode, resp.AsString())
		var page notificationPage
		suite.Require().NoError(resp.AsJSON(&page))
		suite.Require().NotNil(page.Items)
		pages++
		walked = append(walked, page.Items...)
		if page.NextCursor == nil {
			break
		}
		cursor = *page.NextCursor
		suite.Require().Less(pages, 10)
	}
	suite.Equal(3, pages)
	suite.Require().Len(walked, total)
	for i := range legacy {
		suite.Equal(legacy[i].ID, walked[i].ID)
	}

	// Cursor only → default page size; the response is an object even when empty.
	resp = suite.helpers.MakeRequest("GET", "/notifications/history?cursor=", nil, token)
	suite.Require().Equal(http.StatusOK, resp.StatusCode)
	var page notificationPage
	suite.Require().NoError(resp.AsJSON(&page))
	suite.Len(page.Items, total)
	suite.Nil(page.NextCursor)
	suite.Contains(resp.AsString(), `"next_cursor":null`)

	other, _ := suite.helpers.RegisterAndLoginUser("notifother")
	resp = suite.helpers.MakeRequest("GET", "/notifications/history?limit=5", nil, other)
	suite.Require().Equal(http.StatusOK, resp.StatusCode)
	suite.JSONEq(`{"items":[],"next_cursor":null}`, resp.AsString())

	for _, bad := range []string{"limit=0", "limit=101", "limit=abc", "limit=-1", "cursor=garbage", "limit=5&cursor=AAAA"} {
		resp := suite.helpers.MakeRequest("GET", "/notifications/history?"+bad, nil, token)
		suite.Equal(http.StatusBadRequest, resp.StatusCode, bad)
	}
}

// TestBudgetAlertIsSentAfterCommit: crossing 70% of a budget produces one
// asynchronous budget_warning notification once the request committed.
func (suite *E2ETestSuite) TestBudgetAlertIsSentAfterCommit() {
	flow := suite.helpers.CreateUserFlow("budgetalert")
	token := flow.Token

	resp := suite.helpers.MakeRequest("POST", "/budget", map[string]any{"category_id": flow.CategoryID, "amount": 500}, token)
	suite.Require().Equal(http.StatusCreated, resp.StatusCode, resp.AsString())

	resp = suite.helpers.MakeRequest("POST", "/transaction", map[string]any{
		"name": "groceries", "description": "big shop", "amount": 400, "type_transation": "bill",
		"account_id": flow.AccountID, "category_id": flow.CategoryID,
	}, token)
	suite.Require().Contains([]int{http.StatusOK, http.StatusCreated}, resp.StatusCode, resp.AsString())

	var alerts []notificationItem
	suite.helpers.WaitForCondition(func() bool {
		resp := suite.helpers.MakeRequest("GET", "/notifications/history?limit=10", nil, token)
		var page notificationPage
		if resp.StatusCode != http.StatusOK || resp.AsJSON(&page) != nil {
			return false
		}
		alerts = page.Items
		return len(alerts) > 0
	}, 15*time.Second, "budget alert notification")
	suite.Require().Len(alerts, 1)
	suite.Equal("budget_warning", alerts[0].Type)
}

// TestResponsesAreGzipped: JSON responses >= 1 KB are gzipped for clients
// that accept it, with Vary and an exact Content-Length; small ones are not.
func (suite *E2ETestSuite) TestResponsesAreGzipped() {
	token, _ := suite.helpers.RegisterAndLoginUser("gzipuser")
	for range 12 {
		resp := suite.helpers.MakeRequest("POST", "/notifications/test", nil, token)
		suite.Require().Equal(http.StatusOK, resp.StatusCode)
	}

	raw := &http.Client{Transport: &http.Transport{DisableCompression: true}, Timeout: 30 * time.Second}
	get := func(path, acceptEncoding string) (*http.Response, []byte) {
		req, err := http.NewRequest(http.MethodGet, suite.server.URL+path, nil)
		suite.Require().NoError(err)
		req.Header.Set("Authorization", "Bearer "+token)
		if acceptEncoding != "" {
			req.Header.Set("Accept-Encoding", acceptEncoding)
		}
		resp, err := raw.Do(req)
		suite.Require().NoError(err)
		defer func() { _ = resp.Body.Close() }()
		body, err := io.ReadAll(resp.Body)
		suite.Require().NoError(err)
		return resp, body
	}

	plainResp, plain := get("/notifications/history", "")
	suite.Require().Equal(http.StatusOK, plainResp.StatusCode)
	suite.Require().Greater(len(plain), 1024)
	suite.Empty(plainResp.Header.Get("Content-Encoding"))
	suite.Contains(plainResp.Header.Values("Vary"), "Accept-Encoding")

	gzResp, compressed := get("/notifications/history", "gzip, deflate, br")
	suite.Require().Equal(http.StatusOK, gzResp.StatusCode)
	suite.Equal("gzip", gzResp.Header.Get("Content-Encoding"))
	suite.Contains(gzResp.Header.Values("Vary"), "Accept-Encoding")
	suite.Equal(strconv.Itoa(len(compressed)), gzResp.Header.Get("Content-Length"))
	suite.Less(len(compressed), len(plain))
	zr, err := gzip.NewReader(bytes.NewReader(compressed))
	suite.Require().NoError(err)
	decoded, err := io.ReadAll(zr)
	suite.Require().NoError(err)
	suite.True(json.Valid(decoded))
	suite.Equal(plain, decoded)

	smallResp, _ := get("/notifications/history?limit=1", "gzip")
	suite.Equal(http.StatusOK, smallResp.StatusCode)
	suite.Empty(smallResp.Header.Get("Content-Encoding"), "bodies under 1 KB are not compressed")
}
