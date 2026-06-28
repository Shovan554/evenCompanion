import Foundation

// MARK: - Pure helper

/// Builds the publisher WebSocket URL: `\(base)/ws?token=<percent-encoded>&role=pub`.
/// The token is percent-encoded using the query-item character set, which encodes
/// characters such as space, slash, `+`, `=`, `&`, etc.
/// Returns nil if `base` is not a valid URL.
public func publisherURL(base: String, token: String) -> URL? {
    guard !base.isEmpty, var components = URLComponents(string: base) else { return nil }
    guard components.scheme != nil else { return nil }
    components.path = "/ws"
    // Percent-encode the token manually so even `/` is encoded
    // (URLQueryItem leaves `/` unencoded per RFC 3986; we encode it explicitly for safety)
    let allowed = CharacterSet.urlQueryAllowed.subtracting(CharacterSet(charactersIn: "/+&=?#"))
    let encodedToken = token.addingPercentEncoding(withAllowedCharacters: allowed) ?? token
    // Build the query string directly to preserve our custom encoding
    components.percentEncodedQuery = "token=\(encodedToken)&role=pub"
    return components.url
}

// MARK: - Protocol

public protocol RelayPublishing: AnyObject {
    var onCommand: ((String) -> Void)? { get set }
    func start()
    func publish(_ json: String)
    func stop()
}

// MARK: - WebSocket implementation

public final class WebSocketRelayPublisher: RelayPublishing, @unchecked Sendable {

    public var onCommand: ((String) -> Void)?

    private let base: String
    private let token: String
    private var task: URLSessionWebSocketTask?
    private var stopped = false
    private var attempt = 0

    public init(base: String, token: String) {
        self.base = base
        self.token = token
    }

    public func start() {
        stopped = false
        attempt = 0
        connect()
    }

    public func publish(_ json: String) {
        guard let task = task, task.state == .running else { return }
        task.send(.string(json)) { _ in }
    }

    public func stop() {
        stopped = true
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
    }

    // MARK: - Private

    private func connect() {
        guard !stopped else { return }
        guard let url = publisherURL(base: base, token: token) else { return }
        let t = URLSession.shared.webSocketTask(with: url)
        task = t
        t.resume()
        receiveLoop(task: t)
    }

    private func receiveLoop(task: URLSessionWebSocketTask) {
        task.receive { [weak self] result in
            guard let self = self, !self.stopped else { return }
            switch result {
            case .success(let msg):
                self.attempt = 0
                if case .string(let text) = msg {
                    self.onCommand?(text)
                }
                self.receiveLoop(task: task)
            case .failure:
                self.scheduleReconnect()
            }
        }
    }

    private func scheduleReconnect() {
        guard !stopped else { return }
        let delay = min(10.0, 0.1 * pow(2.0, Double(attempt)))
        attempt += 1
        DispatchQueue.global().asyncAfter(deadline: .now() + delay) { [weak self] in
            guard let self = self, !self.stopped else { return }
            self.connect()
        }
    }
}
