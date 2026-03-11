import Testing
@testable import gestorpresupuesto

@Suite("SSE Parsing Tests")
struct SSEParsingTests {

    @Test func processLine_dataField() {
        var parser = SSEParser()
        _ = parser.processLine("data: hello world")
        let event = parser.processLine("")

        #expect(event != nil)
        #expect(event?.data == "hello world")
        #expect(event?.event == "message")
    }

    @Test func processLine_eventField() {
        var parser = SSEParser()
        _ = parser.processLine("event: notification")
        _ = parser.processLine("data: test")
        let event = parser.processLine("")

        #expect(event?.event == "notification")
        #expect(event?.data == "test")
    }

    @Test func processLine_idField() {
        var parser = SSEParser()
        _ = parser.processLine("id: 42")
        _ = parser.processLine("data: test")
        let event = parser.processLine("")

        #expect(event?.id == "42")
    }

    @Test func processLine_retryField() {
        var parser = SSEParser()
        _ = parser.processLine("retry: 3000")
        _ = parser.processLine("data: test")
        let event = parser.processLine("")

        #expect(event?.retry == 3000)
    }

    @Test func processLine_commentIgnored() {
        var parser = SSEParser()
        _ = parser.processLine(": this is a comment")
        let event = parser.processLine("")

        #expect(event == nil)
    }

    @Test func processLine_multiLineData() {
        var parser = SSEParser()
        _ = parser.processLine("data: line1")
        _ = parser.processLine("data: line2")
        let event = parser.processLine("")

        #expect(event?.data == "line1\nline2")
    }

    @Test func processLine_emptyDataIgnored() {
        var parser = SSEParser()
        let event = parser.processLine("")
        #expect(event == nil)
    }

    @Test func processLine_defaultEventIsMessage() {
        var parser = SSEParser()
        _ = parser.processLine("data: test")
        let event = parser.processLine("")

        #expect(event?.event == "message")
    }

    @Test func processLine_resetsAfterDispatch() {
        var parser = SSEParser()
        _ = parser.processLine("event: custom")
        _ = parser.processLine("data: first")
        _ = parser.processLine("")

        _ = parser.processLine("data: second")
        let event = parser.processLine("")

        #expect(event?.event == "message")
        #expect(event?.data == "second")
    }

    @Test func processBuffer_multipleEvents() {
        var parser = SSEParser()
        let text = "data: event1\n\ndata: event2\n\n"
        let events = parser.processBuffer(text)

        #expect(events.count == 2)
        #expect(events[0].data == "event1")
        #expect(events[1].data == "event2")
    }
}
