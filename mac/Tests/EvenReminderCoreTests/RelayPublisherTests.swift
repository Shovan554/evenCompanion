import XCTest
@testable import EvenReminderCore

final class PublisherURLTests: XCTestCase {

    func testPublisherURL_validBase_producesCorrectURL() {
        let url = publisherURL(base: "wss://host", token: "mytoken")
        XCTAssertNotNil(url)
        XCTAssertEqual(url?.scheme, "wss")
        XCTAssertEqual(url?.host, "host")
        XCTAssertEqual(url?.path, "/ws")
        // Token must appear in query
        let query = url?.query ?? ""
        XCTAssertTrue(query.contains("token=mytoken"), "Expected token=mytoken in query, got: \(query)")
        XCTAssertTrue(query.contains("role=pub"), "Expected role=pub in query, got: \(query)")
    }

    func testPublisherURL_tokenWithSpecialChars_isPercentEncoded() {
        // Token "a b/c" contains space and slash which must be percent-encoded in the query
        let url = publisherURL(base: "wss://host", token: "a b/c")
        XCTAssertNotNil(url)
        // URLComponents stores query decoded; check the absoluteString for encoding
        let raw = url?.absoluteString ?? ""
        // space → %20, slash → %2F
        XCTAssertTrue(raw.contains("a%20b%2Fc") || raw.contains("a+b%2Fc"),
                      "Expected percent-encoded token in URL string, got: \(raw)")
    }

    func testPublisherURL_invalidBase_returnsNil() {
        let url = publisherURL(base: "not a valid url ://bad", token: "tok")
        XCTAssertNil(url)
    }

    func testPublisherURL_emptyBase_returnsNil() {
        let url = publisherURL(base: "", token: "tok")
        XCTAssertNil(url)
    }

    func testPublisherURL_pathIsSlashWs() {
        let url = publisherURL(base: "wss://example.com", token: "t")
        XCTAssertEqual(url?.path, "/ws")
    }
}
