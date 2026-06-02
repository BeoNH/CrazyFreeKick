import { _decorator, Component, Label, Tween, tween } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('NumberScrolling')
export class NumberScrolling extends Component {
    @property({ tooltip: 'Thời gian chạy hiệu ứng' })
    public time: number = 0.3;

    // Xác định có cần làm tròn số về số nguyên hay không
    @property({ tooltip: 'Giữ số nguyên', displayName: 'keepInteger' })
    public keepInteger: boolean = true;

    // Label hiển thị giá trị
    @property({ tooltip: 'Label hiển thị', type: Label })
    private label: Label = null;

    private _value: number = 0;
    public get value(): number { return this._value; }
    public set value(val: number) {
        // Nếu keepInteger = true thì làm tròn xuống
        this._value = this.keepInteger ? Math.floor(val) : val;
        this.label.string = this._value.toString();
    }

    // Tween hiện tại đang chạy
    private currentTween: Tween<NumberScrolling> = null;
    // Giá trị mục tiêu cuối cùng
    private lastTarget: number = 0;

    protected onLoad() {
        this.init();
    }

    // Khởi tạo component: tự gán label nếu chưa được gán và đặt giá trị ban đầu là 0
    private init() {
        if (!this.label) {
            this.label = this.getComponent(Label);
        }
        this.value = 0;
    }

    // Đặt giá trị cho label mà không có hiệu ứng
    public setValue(value: number) {
        this.value = value;
    }

    // Đặt thời gian hiệu ứng
    public setTime(time: number) {
        this.time = time;
    }

    /**
     * Chạy hiệu ứng số chạy (tween) từ giá trị hiện tại đến target
     * @param target Giá trị mục tiêu
     * @param time Thời gian chạy hiệu ứng (nếu không truyền sẽ dùng giá trị mặc định)
     * @param callback Hàm callback sau khi hiệu ứng hoàn thành
     * @returns Promise<void> khi hiệu ứng kết thúc
     */
    public to(target: number, time: number = null, callback?: () => void): Promise<void> {
        return new Promise<void>(resolve => {
            // Dừng tween hiện tại nếu có
            if (this.currentTween) {
                this.currentTween.stop();
                this.currentTween = null;
            }
            // Cập nhật thời gian nếu được truyền vào
            if (time != null) {
                this.time = time;
            }
            this.lastTarget = target;
            // Tạo tween chạy hiệu ứng thay đổi giá trị
            this.currentTween = tween<NumberScrolling>(this)
                .to(this.time, { value: target })
                .call(() => {
                    callback && callback();
                    this.currentTween = null;
                    resolve();
                })
                .start();
        });
    }
}
