import { fireEvent, render, screen } from '@testing-library/react';
import { MobileVoiceFab } from '@/components/voice/MobileVoiceFab';

describe('MobileVoiceFab', () => {
  it('renders a persistent bottom floating voice button', () => {
    render(<MobileVoiceFab label="说话记事" onClick={jest.fn()} />);

    const wrapper = screen.getByTestId('mobile-voice-fab');
    const button = screen.getByRole('button', { name: '说话记事' });

    expect(wrapper).toHaveClass('fixed', 'bottom-6', 'md:hidden');
    expect(button).toHaveClass('rounded-full');
  });

  it('opens voice input when tapped', () => {
    const onClick = jest.fn();
    render(<MobileVoiceFab label="说话记事" onClick={onClick} />);

    fireEvent.click(screen.getByRole('button', { name: '说话记事' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
